class LoanGrader {
  label(score, defaults) {
    return 'Applicant band: ' + this.#band(score, defaults);
  }

  #band(score, defaults) {
    if (defaults > 2) return 'reject';
    if (score >= 720) return 'prime';
    if (score >= 640) return defaults === 0 ? 'standard' : 'subprime';
    return 'reject';
  }
}

module.exports = { LoanGrader };
