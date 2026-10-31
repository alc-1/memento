// Phones and other small screens. Keep in sync with the (max-width: 640px) rule in global.css.
const SMALL = matchMedia('(max-width: 640px)');

export const isSmallScreen = () => SMALL.matches;
export const onScreenSizeChange = (callback) => SMALL.addEventListener('change', callback);

// Desktop-class input: a fine pointer that can hover. Phones and tablets answer false, so nothing
// pops the on-screen keyboard open on page load.
export const hasFinePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
