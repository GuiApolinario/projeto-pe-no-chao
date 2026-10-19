import { describe, expect, it } from 'vitest';
import { centavos, cpfCnpjValido, data, dinheiro, lerData, lerDinheiro, somar } from './formato';
import { crc16, gerarPixCopiaECola, normalizarChave } from './pix';
import { diferencaExtrato, lerCSV, lerOFX, sugerirCorrespondencias } from './extrato';
import { paraCSV } from './exportar';

describe('formatação brasileira e dinheiro', () => {
  it('formata moeda e data', () => {
    expect(dinheiro(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(dinheiro(null)).toBe('—');
    expect(data('2026-02-15')).toBe('15/02/2026');
  });
  it('soma sem erro de ponto flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(somar([0.1, 0.2])).toBe(0.3);
    expect(somar(['19.99', '0.01', 80])).toBe(100);
    expect(centavos('10.005')).toBe(1001);
  });
  it('lê valores digitados', () => {
    expect(lerDinheiro('1.234,56')).toBe('1234.56');
    expect(lerDinheiro('R$ 10')).toBe('10.00');
    expect(lerDinheiro('10,5')).toBe('10.50');
    expect(lerDinheiro('1234.56')).toBe('1234.56');
    expect(lerDinheiro('1.234')).toBe('1234.00');
    expect(lerDinheiro('-250,00')).toBe('-250.00');
    expect(lerDinheiro('(5,00)')).toBe('-5.00');
    expect(lerDinheiro('abc')).toBeNull();
  });
  it('lê datas', () => {
    expect(lerData('05/03/2026')).toBe('2026-03-05');
    expect(lerData('5/3/26')).toBe('2026-03-05');
    expect(lerData('20260305120000[-3:BRT]')).toBe('2026-03-05');
    expect(lerData('31/02/2026')).toBeNull();
  });
  it('valida CPF/CNPJ', () => {
    expect(cpfCnpjValido('529.982.247-25')).toBe(true);
    expect(cpfCnpjValido('111.111.111-11')).toBe(false);
    expect(cpfCnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cpfCnpjValido('11.222.333/0001-80')).toBe(false);
  });
});

describe('PIX copia e cola', () => {
  it('calcula CRC16 CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('gera payload válido', () => {
    const p = gerarPixCopiaECola({ chave: 'contato@penochao.org', nome: 'Projeto Pé no Chão', cidade: 'Votorantim', valor: 25 });
    expect(p.startsWith('000201')).toBe(true);
    expect(p).toContain('br.gov.bcb.pix');
    expect(p).toContain('540525.00');
    expect(p).toContain('5918PROJETO PE NO CHAO');
    expect(p).toContain('6010VOTORANTIM');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
  it('normaliza chaves', () => {
    expect(normalizarChave('(15) 99999-1234')).toBe('+5515999991234');
    expect(normalizarChave('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizarChave('Fulano@Email.com')).toBe('fulano@email.com');
  });
});

describe('importação de extratos', () => {
  it('lê CSV com ; e valores brasileiros', () => {
    const csv = 'Data;Histórico;Documento;Valor\n01/02/2026;Saldo Anterior;;1.000,00\n10/02/2026;PIX RECEBIDO;123;5.000,00\n16/02/2026;PIX ENVIADO;124;-250,00\n28/02/2026;TARIFA;;5,00 D\n';
    const r = lerCSV(csv);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas.map((l) => l.valor)).toEqual(['5000.00', '-250.00', '-5.00']);
    expect(r.dataInicio).toBe('2026-02-10');
    expect(diferencaExtrato('1000.00', '5745.00', r.linhas)).toBe(0);
  });
  it('lê CSV com colunas de crédito e débito', () => {
    const csv = 'data,descricao,credito,debito\n2026-03-01,"Doação, empresa",100.00,\n2026-03-02,Compra,,30.50\n';
    const r = lerCSV(csv);
    expect(r.linhas.map((l) => l.valor)).toEqual(['100.00', '-30.50']);
    expect(r.linhas[0].descricao).toBe('Doação, empresa');
  });
  it('lê OFX', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><DTSTART>20260201<DTEND>20260228
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260210120000[-3:BRT]<TRNAMT>5000.00<FITID>F1<MEMO>PIX RECEBIDO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260216<TRNAMT>-250.00<FITID>F2<MEMO>PIX ENVIADO</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>5750.00<DTASOF>20260228</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const r = lerOFX(ofx);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[1]).toMatchObject({ data: '2026-02-16', valor: '-250.00', fitid: 'F2' });
    expect(r.saldoFinal).toBe('5750.00');
    expect(r.dataInicio).toBe('2026-02-01');
  });
  it('sugere correspondências sem duplicar candidatos', () => {
    const linhas = [
      { data: '2026-02-16', valor: '-250.00' },
      { data: '2026-02-17', valor: '-250.00' },
      { data: '2026-02-10', valor: '5000.00' },
    ];
    const s = sugerirCorrespondencias(linhas, [
      { id: 'p1', tipo: 'pagamento', data: '2026-02-17', valor: -250, descricao: '' },
      { id: 'r1', tipo: 'receita', data: '2026-02-20', valor: 5000, descricao: '' },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ linhaIndice: 1, candidato: { id: 'p1' } });
  });
});

describe('exportação', () => {
  it('gera CSV compatível com Excel brasileiro', () => {
    const csv = paraCSV([{ a: 'x;y', b: 1.5 }], [{ chave: 'a', titulo: 'A' }, { chave: 'b', titulo: 'B', tipo: 'dinheiro' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"x;y";1,50');
  });
});
