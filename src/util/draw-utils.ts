import gui from 'gui';

// Create a circle.
export function createCirclePath(painter: gui.Painter, center: gui.PointF, radius: number) {
  painter.beginPath();
  painter.arc(center, radius, 0, 2 * Math.PI);
}

// Create rounded rect.
export function createRoundedCornerPath(painter: gui.Painter, r: gui.RectF, radius: number) {
  const degrees = Math.PI / 180;
  painter.beginPath();
  painter.arc(
    {x: r.x + r.width - radius, y: r.y + radius},
    radius, -90 * degrees, 0);
  painter.arc(
    {x: r.x + r.width - radius, y: r.y + r.height - radius},
    radius, 0, 90 * degrees);
  painter.arc(
    {x: r.x + radius, y: r.y + r.height - radius},
    radius, 90 * degrees, 180 * degrees);
  painter.arc(
    {x: r.x + radius, y: r.y + radius},
    radius, 180 * degrees, 270 * degrees);
  painter.closePath();
}
