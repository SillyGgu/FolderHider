// Indices of nodes that can stay in place while the remaining nodes move.
export function getStableIndices(positions) {
    const tails = [];
    const tailIndices = [];
    const previous = new Array(positions.length).fill(-1);

    positions.forEach((position, index) => {
        if (position < 0) return;
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (tails[middle] < position) low = middle + 1;
            else high = middle;
        }
        if (low > 0) previous[index] = tailIndices[low - 1];
        tails[low] = position;
        tailIndices[low] = index;
    });

    const stable = new Set();
    let index = tailIndices[tails.length - 1];
    while (index !== undefined && index !== -1) {
        stable.add(index);
        index = previous[index];
    }
    return stable;
}
