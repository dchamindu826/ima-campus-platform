const handleBack = (selectionLevel, biz) => {
    // simplified mock
    const streams = biz ? (biz.streams || 1) : 0;
    const batches = biz ? (biz.batches || 1) : 0;
    
    let newLevel = selectionLevel;
    
    if (selectionLevel === 1) {
        newLevel = 0;
    } else if (selectionLevel === 2) {
        if (streams === 1) {
            newLevel = 0;
        } else {
            newLevel = 1;
        }
    } else if (selectionLevel === 3) {
        if (batches === 1) {
            if (streams === 1) {
                newLevel = 0;
            } else {
                newLevel = 1;
            }
        } else {
            newLevel = 2;
        }
    }
    return newLevel;
};
console.log("3 batches, 1 stream, at level 3, goes to:", handleBack(3, {batches: 3, streams: 1})); // expect 2
console.log("3 batches, 1 stream, at level 2, goes to:", handleBack(2, {batches: 3, streams: 1})); // expect 0
