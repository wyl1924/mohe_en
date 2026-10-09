function layoutBoardPieces(board, width, height) {
  const sourceWidth = board.width || 800;
  const sourceHeight = board.height || 1075;
  return (board.pieces || []).map((piece, index) => {
    const crop = piece.crop, target = piece.target;
    const targetWidth = target.width / 100 * width;
    const targetHeight = target.height / 100 * height;
    const cropWidth = crop.width / 100 * sourceWidth;
    const cropHeight = crop.height / 100 * sourceHeight;
    const scale = Math.min(targetWidth / cropWidth, targetHeight / cropHeight);
    const imageWidth = sourceWidth * scale;
    const imageHeight = sourceHeight * scale;
    return {
      index, x: target.x / 100 * width, y: target.y / 100 * height,
      width: targetWidth, height: targetHeight, imageWidth, imageHeight,
      cropLeft: (targetWidth - cropWidth * scale) / 2,
      cropTop: (targetHeight - cropHeight * scale) / 2,
      cropWidth: cropWidth * scale, cropHeight: cropHeight * scale,
      imageLeft: (targetWidth - cropWidth * scale) / 2 - crop.x / 100 * imageWidth,
      imageTop: (targetHeight - cropHeight * scale) / 2 - crop.y / 100 * imageHeight
    };
  });
}
if (typeof module === 'object' && module.exports) module.exports = layoutBoardPieces;
else window.MoheBoardLayout = layoutBoardPieces;
