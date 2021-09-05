export function flash(...elements) {
  const rgbArr = [170, 0, 0];
  let flash = "rgb(" + rgbArr.toString() + ")",
    colorDirection = 1;
  // this will flash quickly until intervalId is cleared
  const intervalId = window.setInterval(() => {
    elements.forEach((target) => {
      target.parentNode.firstChild.setAttribute("fill", flash);
    });
    rgbArr[1] += 5 * colorDirection;
    rgbArr[2] += 10 * colorDirection;
    if (rgbArr[1] >= 255 || rgbArr[1] <= 0) {
      colorDirection = -colorDirection;
    }
    flash = "rgb(" + rgbArr.toString() + ")";
  }, 15);
  // save the current colors
  const initialColors = elements.map((target) =>
    target.parentNode.firstChild.getAttribute("fill")
  );
  // after timeout, clear flashing and set colors back to original values
  window.setTimeout(function () {
    window.clearInterval(intervalId);
    elements.forEach((target, index) => {
      target.parentNode.firstChild.setAttribute("fill", initialColors[index]);
    });
  }, 3000);
  return elements;
}

export default { flash };
