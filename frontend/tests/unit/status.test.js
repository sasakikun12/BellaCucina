import { describe, it, expect } from "vitest";
import { money, quantity, elapsedLabel, isLowStock, resolvePhotoUrl } from "../../src/lib/status";

describe("lib/status — money", () => {
  it("formata em real brasileiro", () => {
    expect(money(19.9)).toMatch(/R\$\s?19,90/);
  });
});

describe("lib/status — quantity", () => {
  it("mantém a unidade quando o valor não cruza o limite de 1 ou 1000", () => {
    expect(quantity(5, "kg")).toBe("5 kg");
    expect(quantity(999, "ml")).toBe("999 ml");
  });

  it("desce para a unidade menor abaixo de 1 (kg->g, L->ml)", () => {
    expect(quantity(0.5, "kg")).toBe("500 g");
    expect(quantity(0.005, "L")).toBe("5 ml");
  });

  it("sobe para a unidade maior a partir de 1000 (g->kg, ml->L)", () => {
    expect(quantity(3990, "ml")).toBe("3.99 L");
    expect(quantity(1000, "g")).toBe("1 kg");
  });

  it("preserva o sinal, usado nos deltas do histórico de movimentações", () => {
    expect(quantity(-1500, "ml")).toBe("-1.5 L");
  });

  it("não converte unidades sem par definido (ex. \"un\")", () => {
    expect(quantity(0.5, "un")).toBe("0.5 un");
  });
});

describe("lib/status — elapsedLabel", () => {
  it("mostra só minutos abaixo de 1h", () => {
    expect(elapsedLabel(new Date(Date.now() - 5 * 60_000))).toBe("5min");
  });

  it("mostra horas e minutos quando passa de 1h", () => {
    expect(elapsedLabel(new Date(Date.now() - 125 * 60_000))).toBe("2h 5min");
  });

  it('omite "0min" quando os minutos restantes são zero', () => {
    expect(elapsedLabel(new Date(Date.now() - 120 * 60_000))).toBe("2h");
  });
});

describe("lib/status — isLowStock", () => {
  it("é true quando o estoque atual é menor ou igual ao mínimo", () => {
    expect(isLowStock({ currentStock: 2, minStock: 2 })).toBe(true);
    expect(isLowStock({ currentStock: 1, minStock: 2 })).toBe(true);
  });

  it("é false quando o estoque atual é maior que o mínimo", () => {
    expect(isLowStock({ currentStock: 3, minStock: 2 })).toBe(false);
  });
});

describe("lib/status — resolvePhotoUrl", () => {
  it("retorna null para valores vazios", () => {
    expect(resolvePhotoUrl(null)).toBeNull();
    expect(resolvePhotoUrl("")).toBeNull();
  });

  it("mantém URLs absolutas e data URIs intocadas", () => {
    expect(resolvePhotoUrl("https://picsum.photos/x.jpg")).toBe("https://picsum.photos/x.jpg");
    expect(resolvePhotoUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });

  it("resolve um caminho relativo contra a URL base da API", () => {
    expect(resolvePhotoUrl("/uploads/x.jpg")).toBe("http://localhost:4000/uploads/x.jpg");
  });

  it("mantém URLs sem esquema (protocol-relative) intocadas", () => {
    expect(resolvePhotoUrl("//cdn.exemplo/x.jpg")).toBe("//cdn.exemplo/x.jpg");
  });
});

describe("lib/status — quantity (ramos de borda)", () => {
  it("valor zero não é reescalado (abs > 0 falso)", () => {
    expect(quantity(0, "kg")).toBe("0 kg");
  });

  it("valor não-inteiro que não cruza limites mantém a unidade e apara zeros", () => {
    expect(quantity(2.5, "kg")).toBe("2.5 kg");
  });
});
