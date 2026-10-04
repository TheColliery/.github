// The Release mirror's list (UMB-445, BB-30): the org repositories whose Releases carry the downloads a visitor installs from. DATA ONLY: no function, no
// credential. `keep` = releases held per repository (the same N as the GitHub side's ZIP prune, AR-71 (a2)). Adding a repository here is the whole change.
export default {
  org: 'TheColliery',
  keep: 2,
  repos: ['CoalMine', 'CoalTipple', 'CoalBoard', 'CoalHearth', 'CoalFace', 'CoalWash', 'CoalLedger', 'CoalGob'],
};
