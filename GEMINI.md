# HumanizeAnythingFully

Humanize any text, PDF, or document without changing its topic, structure, format, design, or images. Only the prose wording changes.

## Workflow

1. Take in the input. Accept text, Markdown, or a PDF. Keep the original file untouched. For a PDF, extract the text with PyMuPDF and keep the full structure: title page, declaration, certificate, abstract, contents, lists, chapters, sections, tables, figures, bibliography. Extract every image and reuse those exact images later, never redraw or replace them. If the PDF is scanned images only, say so plainly instead of guessing at the words. Measure the original layout first: page size, body font size, text block width.

2. Rewrite every prose sentence fully. Use a natural human voice: unpredictable word choices, wildly varying sentence lengths, short fragments next to long winding sentences, contractions, And/But/So openers, questions, parenthetical asides, concrete specifics. Cut stock AI phrases (delve, moreover, furthermore, crucial, seamless, landscape, testament, unlock, game-changer, navigate, tapestry, showcase, leverage, pivotal, robust, comprehensive). Never use an em dash, use commas or hyphens instead. A sentence counts as rewritten only when its structure changed, not when a few words were swapped. Keep every fact, number, date, citation, heading, section number, table cell value, figure caption, and bibliography entry identical in meaning. Keep front matter that must stay verbatim exactly as the original. For simple factual text, use the personal voice lever: first person where the document allows it, concrete personal details, the writer's own lab or work story, specific places and moments. Keep the word count within 10 percent of the original.

3. Remove plagiarism. Check the prose only, drive similarity to 0 to 1 percent. The local checker matches runs of 7 or more words against public pages, so rebuild every matched sentence structurally (change word order, split it, change voice, start from a different point, add a short human aside) until no 7 word run survives in the same order. Keep quoted text, formulas, names, dates, and numbers untouched. Re-run after every round of fixes.

4. Rebuild the PDF in the exact original format: same page size, margins, fonts, structure, figures, and tables. Fix contents and list page numbers from the real pagination measured in a first render pass, then re-render and check the numbers are stable. Stamp page numbers with PyMuPDF, roman numerals for front matter, arabic for the body, title page unnumbered. Check the built PDF against the original geometry and fix any mismatch before calling it done.

5. Verify. Check 0 em dashes, 0 banned stock words, all citations and sections present. Build a detector sample from the abstract plus the first chapter plus the last chapter. Check it on ZeroGPT and on GPTZero, record the exact scores and every flagged sentence, fix flagged sentences one by one, and re-run every detector after each round. Done means ZeroGPT under 15 percent, GPTZero agreeing it reads human, and plagiarism 0 to 1 percent. State scores honestly, never promise that no detector can find it. Simple school factual text floored ZeroGPT near 55 to 60 percent across five rewrite passes, so report measured scores only.

6. Deliver the humanized PDF plus a plain text version, with the detector percentage, the verdict, and the plagiarism similarity stated plainly next to them.

## Tools

The bundled MCP server exposes `humanize_text` (rewrites text with an LLM endpoint you configure) and `check_text` (local checks only: em dash count, banned words, word count, citations, headings). `humanize_text` needs a free LLM key, for example from build.nvidia.com, and returns an error instead of fake output when no key is set. See `mcp-server/README.md`.

## Limits

Rewrite for clarity and natural voice only. Never use this skill to disguise who wrote graded or academic work. A detector score is a probability, not proof of authorship.
