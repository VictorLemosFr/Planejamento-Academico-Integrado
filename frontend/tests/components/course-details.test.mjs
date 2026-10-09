import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

await build({
  entryPoints: ["src/components/CourseDetails.tsx"],
  outfile: "node_modules/.cache/course-details-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  packages: "external",
});
const require = createRequire(import.meta.url);
const {
  CourseDetails,
} = require("../../node_modules/.cache/course-details-test.cjs");
const course = {
  id: "mdc",
  name: "Matemática Discreta para Computação",
  short_name: "Matemática Discreta",
  period: 1,
  hours: 60,
  type: "mandatory",
  prerequisite_ids: [],
  status: "pending",
  missing_prerequisite_ids: [],
  dependent_ids: [],
  critical: false,
};
function render(overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(CourseDetails, {
      course,
      courses: [course],
      busy: false,
      onAction() {},
      onSelect() {},
      onClose() {},
      readOnly: true,
      ...overrides,
    }),
  );
}

test("official map offers a path to a hypothetical alternative for pending courses", () => {
  const html = render();
  assert.match(html, /href="#alternatives"/);
  assert.match(html, /Criar ou abrir alternativa/);
  assert.match(html, /Para simular a conclusão/);
});

test("official approvals remain read only and do not offer revocation", () => {
  const html = render({
    course: { ...course, status: "completed" },
    official: true,
  });
  assert.match(html, /Aprovação oficial/);
  assert.doesNotMatch(html, /Desfazer aprovação simulada/);
  assert.doesNotMatch(html, /Criar ou abrir alternativa/);
});

test("opening an alternative exposes hypothetical approval actions", () => {
  const html = render({ readOnly: false });
  assert.match(html, /Simular aprovação/);
  assert.match(html, /Planejar para próximo semestre/);
});
