import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

const REFERENCE = `
Incident INC-417

Users could not save approved documents during a regional failover.
The MVP must support about 500 total users and 10 concurrent users.
Users access it through a web browser.
Customer documents must remain in the contracted region.
The external model provider must not train on customer content.

Current implementation snapshot:
- React in apps/web/src/App.tsx
- Express and MongoDB in services/api/
- LangChain with the Bedrock SDK
- GitHub Actions deployment
- log stream prod-save-2026-08-31 showed ECONNRESET
`;

export default {
  name: "alps-reference-routes-only-durable-context",
  description:
    "ALPS reference handling must preserve reproducible product and architecture constraints while leaving ticket metadata and code-recoverable technology facts out of the document.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(4),
      `\n---\n\n# This run`,
      REFERENCE,
      `Use the incident as reference input and produce the user-facing Section 4 approval digest only.`,
      `Do not call tools or print implementation notes.`,
      `In the tail use DURABLE_CONSTRAINT for each saved condition, EPHEMERAL_SOURCE for`,
      `discarded incident metadata, IMPLEMENTATION_DISCRETION for code-recoverable technology`,
      `facts, and APPROVAL_BEFORE_SAVE once.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const durable = tail.findings
      .filter((finding) => /DURABLE_CONSTRAINT/i.test(finding.tag))
      .map((finding) => finding.summary)
      .join("\n");
    const discarded = tail.findings
      .filter((finding) => /EPHEMERAL_SOURCE|IMPLEMENTATION_DISCRETION/i.test(finding.tag))
      .map((finding) => finding.summary)
      .join("\n");

    return [
      expectText(
        visible,
        /500[\s\S]{0,100}10[\s\S]{0,30}(?:concurrent|동시)/i,
        "keeps scale constraints",
      ),
      expectText(visible, /web browser|웹 브라우저/i, "keeps the access boundary"),
      expectText(
        visible,
        /contracted region|계약.{0,20}리전|리전.{0,20}계약/i,
        "keeps the data-residency boundary",
      ),
      expectText(
        visible,
        /must not train|학습.{0,30}(금지|사용하지)|고객.{0,30}학습/i,
        "keeps the provider data-use boundary",
      ),
      expectText(
        visible,
        /Architecture Constraints|아키텍처 제약/i,
        "presents Section 4.2 as Architecture Constraints",
      ),
      expectText(
        visible,
        /승인|approve[\s\S]{0,120}수정|revise[\s\S]{0,120}보류|defer/i,
        "keeps approval before save",
      ),
      expectText(
        durable,
        /500[\s\S]*10[\s\S]*(browser|브라우저)[\s\S]*(region|리전)[\s\S]*(train|학습)/is,
        "tail preserves every durable condition",
      ),
      expectText(
        discarded,
        /(INC-417|ticket|incident|React|Express|MongoDB|LangChain|Bedrock SDK|GitHub Actions|code path|log)/i,
        "tail classifies disposable source and implementation facts",
      ),
      expectText(tail.raw, /APPROVAL_BEFORE_SAVE/i, "records approval before persistence"),
      expectNoText(
        visible,
        /INC-417|App\.tsx|services\/api|React|Express|MongoDB|LangChain|Bedrock SDK|GitHub Actions|ECONNRESET|prod-save/,
        "omits ticket, log, path, and replaceable technology details",
      ),
    ];
  },
};
