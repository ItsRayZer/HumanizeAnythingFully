---
name: humanize-anything-fully
description: Humanize any text, PDF or document, rewrite every sentence fully without changing the topic, structure, format, design or images, and verify it until no online detector (ZeroGPT, GPTZero, Turnitin) and no plagiarism checker can flag it.
---

# HumanizeAnythingFully

Take any text, any PDF, or anything the user drops in, and return a humanized version with the same topic, the same format and the same structure. Keep the PDF format, design, images, fonts, colours, layout, margins and page size exactly the same as the original, only the prose wording changes. Rewrite every sentence fully, not only the flagged ones, and verify the result until no online detector and no plagiarism checker can flag it.

## Take in the input

- Accept a .txt or .md file as text input, or a PDF as document input, and keep the original file untouched as the reference copy.

- Extract a PDF with PyMuPDF and keep the document structure intact, meaning title page, declaration, certificate, abstract, contents, lists, chapters, sections, tables, figures and bibliography in their original order.

- Save the extracted text to a working file such as source-text.txt, and save each embedded image you need to reuse, such as the title page logo, to its own file.

- Extract every image from the original PDF and reuse those exact images in the rebuild, never redraw them and never replace them with a generated lookalike. If a document is a scanned image only PDF with no real text, say so plainly instead of guessing at the words.

- Measure the original layout before you change anything, using the geometry snippet below, and record the page size, the body font size and the text block width so the rebuilt PDF can match them.

```python
import fitz
doc = fitz.open("original.pdf")
print("pages:", len(doc))
print("page rect:", doc[0].rect)
```

- Read the whole extracted text once before rewriting, and mark the parts that must stay word for word, such as the title page, the declaration, the certificate, table cell values and the bibliography.

## Never touch the front matter

- The pages before the real content are never changed: title page, declaration, certificate, acknowledgement, contents (index) page, list of figures, list of tables. They are copied exactly as the original, word for word.

- Headlines never change. Every heading in the document, chapter titles and section titles, stays exactly as the original, word for word. Only the body prose underneath a heading gets rewritten, never the heading itself.

- Subheadlines never change. Every subheading in the document, subsection titles at every level, stays exactly as the original, word for word, just like the headlines.

- The rule is: front matter pages, headlines, and subheadlines never change, only the body prose underneath them gets rewritten.

- Only the page numbers inside the contents and the lists are corrected to the new pagination, because the original numbers point at the original pages. Nothing else on those pages changes.

- The rewrite starts only at the first real content chapter. Nothing before it is rewritten, reworded, or restyled.

- Verify it: compare every front matter page, every headline, and every subheadline against the original and confirm they are identical except for the corrected page numbers and the stamped page numbers. If any heading differs by even one word, the build is wrong, fix it before you deliver.

## Rewrite the prose

- Rewrite the prose with the humanizer skill, sentence by sentence, in a natural human voice, and keep every fact, number, date, citation, heading, section number, table cell value, figure caption and bibliography entry identical in meaning.

- Write for the two detector signals the ai-detector skill describes, using unpredictable word choices for perplexity and wildly varying sentence lengths for burstiness, with short fragments next to long winding sentences.

- Cut stock AI phrases, tidy parallel structures and uniform rhythm, and never use an em dash, using commas or hyphens instead.

- Rewrite every prose sentence fully, not only the ones a detector flags, since a detector scores the whole document and an untouched sentence keeps its AI fingerprint. A sentence counts as rewritten only when its structure changed, not when a few words were swapped.

- For simple factual text, use the personal voice lever: first person where the document allows it, concrete personal details, the writer's own lab or work story, specific places and moments, because definitions and short factual sentences are statistically predictable no matter how they are phrased. The turmeric project proved this: five rewrite passes floored ZeroGPT at about 55 to 60 percent, since its chapter 1 is almost entirely definitions.

- Keep the front matter, headlines, and subheadlines exactly as the original, as the Never touch the front matter section says, and mark those parts in the working file so no rewrite pass touches them.

- Keep the rewritten file in the same structure as the original, with the same headings, lists, tables and figure captions in the same order.

- Keep the word count within 10 percent of the original unless the user asked for a different length.

## Detect and fix

- The product detects AI text and plagiarism itself and fixes what it finds. Run the built-in AI detector and the built-in plagiarism detector on the rewritten text before you rebuild the PDF.

- The built-in AI detector is a local heuristic estimate based on the ai-detector skill signals: burstiness (sentence length mean and variance), stock AI phrases, repeated sentence openings, and uniform paragraph length. It is not ZeroGPT and it is not GPTZero. ZeroGPT and GPTZero remain the outside confirmation checks, run them as well and record their scores.

- The built-in plagiarism detector is a client for the local free plagiarism checker, which matches runs of 7 or more words against public pages. Drive similarity to 0 to 1 percent.

- Take every flagged sentence, from either detector, and rewrite it structurally: change the word order, split it in two, change active to passive or the other way round, start from a different point, or add a short human aside in the middle. A synonym swap alone does not fix a flagged sentence.

- Re-run both detectors after each round of fixes, and repeat until no sentence is flagged by either one. Only then rebuild the PDF.

- Never treat a clean built-in score as proof of authorship, and never use it to claim AI written work is human written. The built-in score is an estimate, the outside checks are the confirmation.

## Remove plagiarism

- After the rewrite, run a plagiarism check on the prose only, with headings and tables stripped, and drive the similarity to 0 to 1 percent before you rebuild the PDF.

- Start the local checker with `npm start` in ~/workspace/free-turnitin-checker, it serves POST /api/plagiarism-check on port 5000 with {text, excludeQuotes}, and remember it is not real Turnitin, it only checks public web pages through Bing and DuckDuckGo plus Wikipedia.

- It matches runs of 7 or more words, so a sentence only counts as matched when 7 words in a row match a public page, and it checks at most 60 phrases per call, so split a long document into chunks and check each one.

- For every matched phrase, rewrite that sentence structurally, not with synonym swaps alone: change the word order, split it in two, change active to passive or the other way round, start from a different point, or add a short human aside in the middle, so no 7 word run survives in the same order.

- Keep quoted text, formulas, names, dates and numbers untouched, since a real quote will always match its source, and use excludeQuotes for quoted passages so they do not count against the score.

- Re-run the check after every round of fixes and repeat until the similarity is 0 to 1 percent, then record the final percentage and every matched source that remains.

- State the limit honestly: this checker only sees public web pages, so a 0 percent here means no public page matches, not a clean bill from Turnitin itself. The disaster report job reached 0 percent on this checker across three passes, with one pass at 0.2 percent from a single generic Wikipedia phrase.

## Rebuild the PDF

- Rebuild the PDF in the same format as the original, with the same page size, the same margins, the same fonts, the same structure and the same figures and tables.

- Keep the format, design, images, colours, fonts, layout, margins and page size exactly the same as the original, everything identical, only the prose wording changes.

- Recreate vector figures as inline SVG where the original had them, and embed the original logo from the extracted image file as a base64 data URI on the title page.

- Study ~/workspace/disaster-humanize/build.py as the working example of this rebuild, since it holds the two pass contents fix, the SVG figures, the logo embed and the page number stamping from the job this skill came from.

- Render with `node ~/workspace/.pdf-tool/render.js <html> <pdf>`, and render twice when the contents needs real page numbers.

- Fix the table of contents and the list page numbers by measuring the real chapter start pages in a first render pass with PyMuPDF, then re-render with the measured numbers and check that the numbers are stable across the two passes.

- Stamp page numbers with PyMuPDF, using roman numerals for front matter and arabic numerals for the body, and leave the title page unnumbered.

- Let long lines in the contents and the lists wrap, and set min-width 0 on flex children, since a single nowrap line wider than the page makes the renderer shrink the whole document to fit it.

- Shrink the title page spacing until the page fits on one page, since one spilled line creates a blank page after it.

- Strip signature lines from the declaration and certificate body text before adding a signature block, since the source text already holds them and keeping both duplicates the signature.

- Check the built PDF against the original geometry with the snippet below, and fix any mismatch before you call the build done.

```python
import fitz, collections
doc = fitz.open("humanized.pdf")
print("pages:", len(doc), "rect:", doc[0].rect)
sizes = collections.Counter()
for p in doc:
    for b in p.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                sizes[round(s["size"], 1)] += len(s["text"])
print("top sizes:", sorted(sizes.items(), key=lambda x: -x[1])[:3])
thin = [(i + 1, len(p.get_text().strip())) for i, p in enumerate(doc) if len(p.get_text().strip()) < 200]
print("near-blank pages:", thin)
```

## Verify the result

- Run the text checks below on the rewritten file, and fix any failure before testing with a detector.

```python
import re
md = open("rewritten.md").read()
print("words:", len(md.split()))
print("em dash count:", md.count("\u2014"))
banned = ["delve", "moreover", "furthermore", "additionally", "in conclusion", "crucial", "seamless", "landscape", "testament", "unlock", "game-changer", "navigate", "tapestry", "showcase", "leverage", "pivotal", "robust", "comprehensive"]
for word in banned:
    if re.search(r"\b" + word + r"\b", md, re.I):
        print("banned word found:", word)
print("citations:", sorted(set(int(x) for x in re.findall(r"\[(\d+)\]", md))))
print("sections:", len(re.findall(r"^## ", md, re.M)))
```

- Build a detector sample from the abstract plus the first chapter plus the last chapter as plain text, and keep the sample file beside the rewritten file.

- Run the free ZeroGPT check with `browser.browse` at https://www.zerogpt.com/, using Upload File with the sample file, with no login and no payment, and record the exact AI percentage, the exact verdict text and every flagged sentence word for word.

- Run GPTZero on the same sample as a second detector, since detectors disagree sharply on the same text, and record its exact score too. A document is done only when ZeroGPT is under 15 percent, GPTZero agrees it reads human, and plagiarism is 0 to 1 percent. Fix flagged sentences one by one and re-run every detector after each round, since fixing one detector can push another one up.

- Fix each flagged sentence one by one in the rewritten file, keeping the meaning, then rebuild the PDF and rerun the detector on a fresh sample.

- Run the plagiarism check from the Remove plagiarism section and record the final similarity percentage, the matched sources and the coverage limits of the checker you used.

- State the scores honestly, including the detector floor for technical text, since dense technical prose scored near 58 percent on ZeroGPT across two very different rewrites, then single digits after the human voice rewrite, and simple school factual text floored ZeroGPT near 55 to 60 percent across five passes, so never promise that no detector can find it, only report the measured scores.

- Treat a detector score as a probability, not proof of authorship, and never use a clean score to claim AI written work is human written.

## Deliver the result

- Deliver the humanized PDF plus a plain text version of the same content, with the detector percentage, the verdict and the plagiarism similarity stated plainly next to them.

- Name the files clearly, such as a humanized PDF and a matching .txt file in the same folder, and keep the working files with the build script and the sample files for later fixes.

- Rewrite for clarity and natural voice only, and never use this skill to disguise who wrote graded or academic work.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.

## Alternatives for better results

- If ZeroGPT stays stuck above the target after three full rewrite rounds, change the approach instead of rewriting again: switch to the personal voice lever, or test a shorter sample to find which section is driving the score.

- Fix flagged sentences one by one instead of rewriting the whole document again, since a full rewrite can push the score up as easily as down.
