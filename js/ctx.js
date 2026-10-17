export const ctx = {
  cfg: null,
  provider: null,
  rerender: () => {},
  lastResult: {},
  currentProfileId: null,
  parentUntil: 0,
  deferredInstall: null,
};

export const go = (hash) => {
  location.hash = hash;
};
