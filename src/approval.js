// Two-step approval gate for spend-effect actions (register, renew, transfer).
//
// The ThatMgmt API currently exposes quote and prepare-registration (validated
// plans) but NO execute endpoints: purchase, renewal, transfer, and DNS changes
// are never executed by the API. When execute endpoints are added, every
// spend-effect tool MUST pass through this gate first:
//
//   Step 1: call domains_get_quote / domains_prepare_registration and show the
//           human the locked price (domain, total, fee).
//   Step 2: the caller passes back the quote id plus an explicit approval flag.
//           This module refuses to proceed unless both are present and match.
//
// Nothing here calls the network. It is pure gate logic, fully tested.

import { ThatMgmtError } from "./thatmgmt.js";

export function buildGate(quote) {
  if (!quote || typeof quote !== "object") {
    throw new ThatMgmtError("Cannot build an approval gate without a quote result.");
  }
  const quoteId =
    quote.quoteId ?? quote.id ?? quote.feeFingerprint ?? quote.totalPayableCents;
  if (quoteId === undefined || quoteId === null || quoteId === "") {
    throw new ThatMgmtError("Quote result carries no usable quote id; cannot gate execution.");
  }
  return {
    quoteId: String(quoteId),
    domain: quote.domain ?? null,
    totalPayableCents:
      typeof quote.totalPayableCents === "number" ? quote.totalPayableCents : null,
    feeFingerprint: quote.feeFingerprint ?? null,
  };
}

export function assertApproved({ quoteId, approved, gate }) {
  if (!gate || typeof gate !== "object" || !gate.quoteId) {
    throw new ThatMgmtError("No approval gate was built from a quote. Get a quote first.");
  }
  if (quoteId === undefined || quoteId === null || String(quoteId) === "") {
    throw new ThatMgmtError(
      "Missing quote id. Pass back the quote id from step 1 so the locked price is bound to this execution."
    );
  }
  if (String(quoteId) !== String(gate.quoteId)) {
    throw new ThatMgmtError(
      "Quote id does not match the approved quote. Get a fresh quote; prices may have changed."
    );
  }
  if (approved !== true) {
    throw new ThatMgmtError(
      "Explicit human approval is required before any spend-effect action. Show the human the locked price first, then retry with approved: true."
    );
  }
  return { ok: true, quoteId: String(gate.quoteId) };
}
