import { demoPayeesPtBr } from "./payees";
import { normalizePhoneNumber } from "../../common/phone-number.util";

describe("pt-BR demo payee contact details", () => {
  const withWebsite = demoPayeesPtBr.filter((p) => p.website);
  const withPhone = demoPayeesPtBr.filter((p) => p.phone);
  const withAddress = demoPayeesPtBr.filter((p) => p.address);

  it("carries contact details on brand payees", () => {
    expect(withWebsite.length).toBeGreaterThan(15);
    expect(withPhone.length).toBeGreaterThan(10);
    expect(withAddress.length).toBeGreaterThan(15);
  });

  it("stores every phone in the normalized E.164 form", () => {
    const offenders = withPhone
      .map((payee) => ({
        payee,
        result: normalizePhoneNumber(payee.phone as string, null),
      }))
      .filter(
        ({ payee, result }) => !result.ok || result.stored !== payee.phone,
      )
      .map(({ payee }) => `${payee.name}: ${payee.phone}`);
    expect(offenders).toEqual([]);
  });

  it("gives every website an absolute https address with a host", () => {
    const offenders = withWebsite
      .filter((payee) => {
        try {
          const url = new URL(payee.website as string);
          return url.protocol !== "https:" || !url.hostname.includes(".");
        } catch {
          return true;
        }
      })
      .map((payee) => `${payee.name}: ${payee.website}`);
    expect(offenders).toEqual([]);
  });

  it("keeps every value inside column and DTO bounds", () => {
    const offenders: string[] = [];
    for (const payee of demoPayeesPtBr) {
      if ((payee.website?.length ?? 0) > 2048)
        offenders.push(`${payee.name}: website`);
      if ((payee.address?.length ?? 0) > 500)
        offenders.push(`${payee.name}: address`);
      if ((payee.phone?.length ?? 0) > 50)
        offenders.push(`${payee.name}: phone`);
    }
    expect(offenders).toEqual([]);
  });

  it("names each payee once", () => {
    const names = demoPayeesPtBr.map((payee) => payee.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
