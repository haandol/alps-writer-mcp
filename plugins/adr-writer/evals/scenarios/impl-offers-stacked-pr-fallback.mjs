import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";

export default {
  name: "impl-offers-stacked-pr-fallback",
  description:
    "When the user requests lower review load but one Feature and one ADR must stay intact, adr-impl may offer an ephemeral dependency-ordered Stacked PR delivery plan without publishing it.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl"),
      `\n---\n\n# This run`,
      `The approved ADR contains one architectural decision: payment idempotency across the`,
      `checkout state flow, provider call, ledger transaction, and duplicate webhook handling.`,
      `The Feature is one observable checkout behavior and the ADR cannot be split into independent`,
      `decisions without duplicating the contract or dividing the vertical slice by technical layer.`,
      `The user explicitly asks to reduce review load and is open to multiple PRs.`,
      `Decide how to decompose delivery, but do not create branches or publish PRs in this run.`,
      `Use KEEP_ONE_ADR, STACK_FALLBACK, EPHEMERAL, and NO_AUTOPUBLISH finding tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const ephemeral =
      tail.findings.find((finding) => /EPHEMERAL/i.test(finding.tag))?.summary ?? "";
    return [
      expectText(
        all,
        /KEEP_ONE_ADR.{0,180}(one|single|하나|유지)/is,
        "keeps the Feature and ADR semantic boundary intact",
      ),
      expectText(
        all,
        /STACK_FALLBACK.{0,240}(Stacked PR|PR stack).{0,240}(dependency|base|순서|의존)/is,
        "offers a dependency-ordered Stacked PR fallback",
      ),
      expectText(
        all,
        /STACK_FALLBACK.{0,300}(review question|리뷰 질문)/is,
        "gives each layer one review question",
      ),
      {
        pass:
          /(do not|does not|not persisted|ephemeral|비영속|저장하지)/i.test(ephemeral) &&
          /(ADR|mapping|registry|권위|artifact)/i.test(ephemeral),
        detail: ephemeral || "missing EPHEMERAL finding",
        label: "keeps the Stack plan out of authoritative artifacts",
      },
      expectText(
        all,
        /NO_AUTOPUBLISH.{0,240}(request|capability|요청|지원|publish|게시)/is,
        "does not publish without an explicit request and capability",
      ),
      expectNoText(
        all,
        /create (?:a )?new ADR|새 ADR|split the ADR|ADR을 분할/i,
        "does not invent ADRs for delivery layers",
      ),
    ];
  },
};
