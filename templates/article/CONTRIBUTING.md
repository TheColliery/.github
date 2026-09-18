# CONTRIBUTING.md—what is actually wanted here, and what is not

Read this section before you write anything. This is not a codebase, and the usual contributing file
would waste your afternoon.

This document is licensed **{{LICENSE_NAME}}** and has a single owner. {{DERIVATIVES_CLAUSE}} So the
ordinary open-source loop—fork, edit, PR—is not the model here, and there is no point pretending
otherwise. Sending one is not rude; it is just something that cannot be merged.

What **is** wanted is narrower and considerably more valuable: **evidence that something in it is
wrong.**

This document makes falsifiable claims about vendor behaviour, standards, and tool defaults. Every
one of those is a hostage to a vendor who can change it without telling anyone. A document that was
correct the day it was published goes quietly wrong while every word of it stays exactly where it
was. Catching one is the most useful thing a reader outside this repository can do, and it is the
thing this project cannot do for itself at scale.

---

## Three things worth sending

### 1 · A correction, with evidence

The unit of a useful report is not "this is wrong." It is:

- **the location**—the rule ID or the register row, and what the document says today, **quoted**;
- **the source**—a URL to the vendor's or standards body's own page. Not a tutorial, not a forum
  answer, not a second-hand document that cites the first one;
- **its class**—specification · vendor documentation · tool default · recommendation. These do not
  weigh the same, and a report that does not say which one it is has skipped the hard part;
- **the exact wording you found there**, quoted rather than summarised;
- **how the two differ**, in a sentence;
- **the date you fetched it**, because the next reader needs to know how old your check is.

**A report with no source cannot be acted on.**

### 2 · A named counter-exemplar

For a value that rests on real-world precedent, the standard's own rule is that it moves **only with
a named counter-exemplar**. Not "most projects do it differently." A real, shipped, nameable thing
that does it another way, named specifically enough that someone else can go and look at it.

### 3 · A re-measurement

Measurements, numbers, and facts are not copyrightable, and **anyone may independently re-measure the
same public corpora and publish their own numbers.** That is expected. It needs no permission.

---

## What will not be accepted

- **Rewordings, restructuring, and style.** The expression is the part the licence protects, and it
  is the owner's.
- **New rules proposed without evidence.** A rule with no source is unproven, and promoting one to
  spec to make a table look complete is the specific failure this document was written against.

---

## Where a report goes

**Open an issue.** {{REPO_ISSUES_URL}}

For a **licence request**—commercial use, adaptation, redistribution of the document—either an issue
or a direct approach to the owner works.

## What happens to it

A correction with evidence is written into [`ERRATA.md`](ERRATA.md) as **reported**, whether or not
anyone agrees with it yet. The owner then rules: **verified**, **rejected**, or **held for the next
version**.

**Entries are never removed, including rejected ones.** A released version does not change—a defect
found in one version is corrected in the next, not edited out of the one it was found in.
