/**
 * キャラクターのステータス
 */
export const CHARACTER_STATUS = {
  character01: {
    main: "ASTEROID",
    sub: "RAYGUST",
    activeCount: 3
  },
  character02: {
    main: "SCOPEON",
    sub: "SHIELD",
    activeCount: 3,
  },
  character03: {
    main: "IBIS",
    sub: "BAGWORM",
    activeCount: 3
  },
  character04: {
    main: "KOGETSU",
    sub: "SHIELD",
    activeCount: 3
  }
};

export const TRIGGER_STATUS = {
  KOGETSU: {
    angle: 120,
    range: 2,
  },
  RAYGUST: {
    angle: 120,
    range: 2,
  },
  SCOPEON: {
    angle: 120,
    range: 1,
  },
  ASTEROID: {
    angle: 60,
    range: 4,
  },
  IBIS: {
    angle: 30,
    range: 10,
  },
  SHIELD: {
    angle: 120,
    range: 1,
  },
  BAGWORM: {
    angle: 60,
    range: 1,
  },
}