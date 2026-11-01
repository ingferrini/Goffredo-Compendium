function shapesOf(region) {
  const shapes = region?.shapes;
  if (!shapes) return [];
  return Array.from(shapes);
}

function polygonPoints(polygon, centre) {
  const raw = polygon?.points;
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const points = [];
  if (typeof raw[0] === 'number') {
    if (raw.length % 2 !== 0) return null;
    for (let index = 0; index < raw.length; index += 2) points.push([raw[index] - centre.x, raw[index + 1] - centre.y]);
  } else {
    for (const point of raw) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
      points.push([point.x - centre.x, point.y - centre.y]);
    }
  }
  return points.length >= 3 ? points : null;
}

function resolvedPolygons(shape, centre) {
  return Array.from(shape?.polygons ?? [])
    .map(polygon => polygonPoints(polygon, centre))
    .filter(Boolean)
    .map(points => ({type: 'polygon', options: {points}}));
}

export function regionOutline(region, bounds) {
  if (!bounds) return [];
  const centre = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
  return shapesOf(region).flatMap(shape => {
    const type = shape?.type ?? shape?._source?.type;
    if (type === 'circle' && Number.isFinite(Number(shape.radius))) {
      return [{type: 'circle', options: {radius: Number(shape.radius)}}];
    }
    if (type === 'rectangle' && !Number(shape.rotation) && Number.isFinite(Number(shape.width)) && Number.isFinite(Number(shape.height))) {
      return [{type: 'rectangle', options: {width: Number(shape.width), height: Number(shape.height)}}];
    }
    return resolvedPolygons(shape, centre);
  });
}
