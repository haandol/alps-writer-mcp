import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, expectText } from "../lib/harness.mjs";

export default {
  name: "impl-review-selects-risk-mode",
  description:
    "/adr-impl-review must choose standard for a localized implementation cleanup and full for requirement/public-contract changes.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `Classify these two review scopes without executing them:`,
      `A. Replace two identical private parsing blocks with one local helper. Public behavior,`,
      `requirements, schema, state, permissions, errors, concurrency, and dependencies are unchanged.`,
      `B. Change retention from 30 to 90 days and add a field to the public API response.`,
      `Use STANDARD and FULL as finding tags and include the scope letter in each summary.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const protectedStandard = tail.findings.filter(
      (finding) =>
        /STANDARD/i.test(finding.tag) &&
        (/(?:^|[|;])\s*(?:스코프\s*|scope\s*)?B(?:\s|:|—|-)/i.test(finding.summary) ||
          /30.{0,30}90|retention.{0,80}(30|90)/i.test(finding.summary)),
    );
    return [
      expectText(all, /STANDARD.{0,180}(A|local|private|helper)/is, "selects standard for A"),
      expectText(all, /FULL.{0,180}(B|30.{0,30}90|retention|public API)/is, "selects full for B"),
      {
        pass: protectedStandard.length === 0,
        detail:
          protectedStandard.map((finding) => `${finding.tag} | ${finding.summary}`).join(" ; ") ||
          "no protected B scope classified as standard",
        label: "does not downgrade protected surfaces to standard",
      },
    ];
  },
};
