/**
 * Copied from underscore
 *
 * @param min
 * @param max
 */
const random = (min: number, max: number): number => {
    if (max == null) {
        max = min;
        min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
};

export { random };
