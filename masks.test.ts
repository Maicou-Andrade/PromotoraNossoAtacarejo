import { describe, it, expect } from "vitest";
import { maskCPF, maskPhone, maskCPFForLGPD, formatDateBR, getTodayISO } from "./masks";

describe("maskCPF", () => {
  it("should format CPF correctly with full digits", () => {
    expect(maskCPF("12345678901")).toBe("123.456.789-01");
  });

  it("should handle partial input", () => {
    expect(maskCPF("123")).toBe("123");
    expect(maskCPF("1234")).toBe("123.4");
    expect(maskCPF("1234567")).toBe("123.456.7");
    expect(maskCPF("1234567890")).toBe("123.456.789-0");
  });

  it("should strip non-digit characters", () => {
    expect(maskCPF("123.456.789-01")).toBe("123.456.789-01");
    expect(maskCPF("abc123def456")).toBe("123.456");
  });

  it("should handle empty input", () => {
    expect(maskCPF("")).toBe("");
  });

  it("should limit to 11 digits", () => {
    expect(maskCPF("123456789012345")).toBe("123.456.789-01");
  });
});

describe("maskPhone", () => {
  it("should format phone correctly with full digits", () => {
    expect(maskPhone("84999887766")).toBe("(84) 99988-7766");
  });

  it("should handle partial input", () => {
    expect(maskPhone("84")).toBe("(84");
    expect(maskPhone("849")).toBe("(84) 9");
    expect(maskPhone("84999")).toBe("(84) 999");
    expect(maskPhone("8499988")).toBe("(84) 99988");
  });

  it("should handle empty input", () => {
    expect(maskPhone("")).toBe("");
  });
});

describe("maskCPFForLGPD", () => {
  it("should mask CPF for LGPD compliance", () => {
    expect(maskCPFForLGPD("123.456.789-01")).toBe("***.456.789-**");
    expect(maskCPFForLGPD("12345678901")).toBe("***.456.789-**");
  });

  it("should handle short CPF", () => {
    expect(maskCPFForLGPD("123")).toBe("***.***.***-**");
  });

  it("should handle specific example from requirements", () => {
    // Example: ***.806.959-**
    expect(maskCPFForLGPD("000.806.959-00")).toBe("***.806.959-**");
  });
});

describe("formatDateBR", () => {
  it("should format ISO date to BR format", () => {
    expect(formatDateBR("2025-02-09")).toBe("09/02/2025");
  });

  it("should handle empty string", () => {
    expect(formatDateBR("")).toBe("");
  });

  it("should return original if not ISO format", () => {
    expect(formatDateBR("invalid")).toBe("invalid");
  });
});

describe("getTodayISO", () => {
  it("should return a valid ISO date string", () => {
    const today = getTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
