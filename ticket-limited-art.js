/* Transparent, two-phase portraits for the ticket-limited Veriti. */
(() => {
  'use strict';

  const ink = '#17192d';
  const palette = {
    prismity: ['#f0feff', '#69e9ed', '#6d60b8', '#ddfaff', '#ed92f4', '#7547aa'],
    polarity: ['#fff4ca', '#f9b34e', '#a95c4e', '#ffeac3', '#e88b53', '#8b3e59'],
    metronity: ['#d5fcb4', '#59d893', '#367787', '#e9ffc6', '#99e35e', '#326c75']
  };

  function shape(context, trace, fill, stroke, width = 2.5) {
    context.beginPath();
    trace(context);
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.stroke();
    }
  }

  function polygon(context, points, fill, stroke, width) {
    const [first, ...rest] = points;
    shape(context, path => {
      path.moveTo(...first);
      for (const point of rest) path.lineTo(...point);
      path.closePath();
    }, fill, stroke, width);
  }

  function stroke(context, points, color, width) {
    const [first, ...rest] = points;
    shape(context, path => {
      path.moveTo(...first);
      for (const point of rest) path.lineTo(...point);
    }, null, color, width);
  }

  function oval(context, x, y, width, height, fill, edge, angle = 0) {
    shape(context, path => path.ellipse(x, y, width, height, angle, 0, Math.PI * 2), fill, edge);
  }

  function gradient(context, x1, y1, x2, y2, colors) {
    const surface = context.createLinearGradient(x1, y1, x2, y2);
    colors.forEach((color, index) => surface.addColorStop(index / (colors.length - 1), color));
    return surface;
  }

  function spark(context, x, y, size, color) {
    polygon(context, [[x, y - size], [x + size * .25, y - size * .24], [x + size, y],
      [x + size * .25, y + size * .24], [x, y + size], [x - size * .25, y + size * .24],
      [x - size, y], [x - size * .25, y - size * .24]], color);
  }

  function badge(context, y, body, strong) {
    const colors = body.slice(strong ? 3 : 0, strong ? 6 : 3);
    oval(context, 72, 124, 47, 9, '#0d122f20');
    const finish = gradient(context, 45, y - 39, 107, y + 48, colors);
    oval(context, 72, y, 49, 49, finish, ink);
    shape(context, path => path.arc(72, y, 46, 3.12, 5.34), null, colors[0], 2.8);
    shape(context, path => path.arc(72, y, 45.5, .19, 1.74), null, '#26254a40', 2.5);
  }

  function face(context, y, strong, shine) {
    for (const direction of [-1, 1]) {
      const x = 72 + direction * 16;
      oval(context, x, y, strong ? 5.5 : 4.4, 7.1, ink, null, direction * -.14);
      oval(context, x - 1.1, y - 1.8, 1.4, 2.1, shine);
      if (strong) stroke(context, [[x + direction * 8, y - 9], [x - direction * 4, y - 6]], ink, 3.1);
    }
    if (strong) {
      shape(context, path => {
        path.moveTo(48, y + 16);
        path.quadraticCurveTo(73, y + 33, 96, y + 14);
        path.bezierCurveTo(93, y + 47, 57, y + 49, 48, y + 16);
      }, ink, ink, 2);
      shape(context, path => {
        path.moveTo(53, y + 21);
        path.quadraticCurveTo(73, y + 33, 91, y + 20);
        path.quadraticCurveTo(87, y + 34, 72, y + 35);
        path.quadraticCurveTo(60, y + 34, 53, y + 21);
      }, '#f9fafa');
      stroke(context, [[65, y + 29], [65, y + 34]], '#433750', 1.2);
      stroke(context, [[79, y + 29], [79, y + 33]], '#433750', 1.2);
    } else {
      shape(context, path => {
        path.moveTo(52, y + 16);
        path.quadraticCurveTo(73, y + 36, 92, y + 15);
      }, null, ink, 3.8);
    }
  }

  function prism(context, x, y, size, strong) {
    context.save();
    context.translate(x, y);
    context.scale(size, size);
    polygon(context, [[0, -23], [26, 17], [6, 25], [-23, 17]], '#b8effb', ink, 2.5);
    polygon(context, [[0, -23], [9, -13], [26, 17], [6, 25]], strong ? '#b771de' : '#6689cc', ink, 1.5);
    polygon(context, [[0, -19], [5, 19], [-19, 15]], strong ? '#f49ae9' : '#77ecf1');
    polygon(context, [[0, -19], [6, 19], [21, 16]], strong ? '#ffd2fe' : '#cee9fe');
    stroke(context, [[-16, 12], [0, -15]], '#ffffff', 2.7);
    context.restore();
  }

  function drawPrismity(context, strong) {
    if (strong) {
      polygon(context, [[66, 43], [125, 23], [136, 40], [134, 62], [74, 51]], '#b86bec66');
      stroke(context, [[78, 48], [126, 33]], '#8eeaff', 3.2);
      stroke(context, [[80, 52], [134, 47]], '#ffadf6', 3.2);
      stroke(context, [[82, 56], [132, 59]], '#ffd7ac', 2.2);
      spark(context, 23, 46, 9.5, '#a4f1fd');
      spark(context, 122, 22, 7, '#ffe0fb');
    }
    badge(context, 79, palette.prismity, strong);
    polygon(context, [[32, 57], [42, 43], [64, 43], [76, 47], [96, 42], [114, 56], [104, 66],
      [80, 61], [63, 66], [46, 62]], '#293958', ink, 2.7);
    stroke(context, [[39, 55], [48, 50], [65, 56]], '#64e9ed', 2.5);
    stroke(context, [[81, 55], [99, 49], [108, 55]], '#f6a6ef', 2.5);
    prism(context, 70, strong ? 34 : 39, strong ? 1.07 : .87, strong);
    face(context, 79, strong, '#d8f7ff');
    oval(context, 38, 92, 4, 2.4, '#eddaff');
    oval(context, 106, 92, 4, 2.4, '#f6d6e7');
  }

  function magnet(context, x, strong, left) {
    context.save();
    context.translate(x, 67);
    context.scale(left ? -1 : 1, 1);
    context.rotate(strong ? -.22 : -.06);
    polygon(context, [[-8, -20], [1, -28], [11, -22], [15, -13], [15, 13], [10, 20], [0, 23],
      [-8, 16], [-3, 8], [3, 12], [6, 9], [6, -9], [2, -13], [-3, -10]],
    gradient(context, -11, -18, 14, 17, ['#e0e4ec', '#8795ad', '#4f5876']), ink, 2.8);
    polygon(context, [[-8, -20], [-3, -10], [2, -13], [4, -15], [-1, -25]], left ? '#68d3ef' : '#f97879', ink, 1.6);
    polygon(context, [[-8, 16], [-3, 8], [3, 12], [4, 15], [-1, 21]], left ? '#f97879' : '#68d3ef', ink, 1.6);
    stroke(context, [[10, -10], [10, 7]], '#f3f8ff', 1.7);
    context.restore();
  }

  function drawPolarity(context, strong) {
    if (strong) {
      shape(context, path => path.ellipse(72, 70, 67, 41, .36, 3.55, 6.4), null, '#88dcff', 2.8);
      shape(context, path => path.ellipse(72, 70, 67, 41, -.36, -.36, 2.6), null, '#f8a797', 2.8);
      spark(context, 13, 34, 8, '#b4e8ff');
      spark(context, 129, 100, 8.5, '#ffdfb5');
    }
    badge(context, 76, palette.polarity, strong);
    polygon(context, [[43, 47], [42, 38], [51, 36], [59, 23], [84, 23], [95, 37], [102, 39],
      [101, 48], [87, 47], [72, 53], [56, 47]], '#515b75', ink, 2.7);
    polygon(context, [[68, 26], [80, 26], [73, 34], [81, 34], [68, 46], [71, 37], [62, 37]],
      strong ? '#fff2ab' : '#ffd171', '#5c414c', 1.4);
    magnet(context, 26, strong, true);
    magnet(context, 118, strong, false);
    face(context, 75, strong, '#ffe9a7');
    oval(context, 41, 95, 3.8, 2.1, '#ffdc9c');
    oval(context, 103, 95, 3.8, 2.1, '#ffdc9c');
  }

  function metronome(context, strong) {
    polygon(context, [[63, 15], [81, 15], [95, 55], [90, 62], [54, 62], [49, 55]],
      gradient(context, 58, 14, 91, 58, ['#fff5b6', '#bda66b', '#69503c']), ink, 2.9);
    polygon(context, [[67, 21], [77, 21], [86, 53], [57, 53]], '#213f42', '#e0c284', 1.5);
    stroke(context, [[65, 34], [78, 34]], '#8eae81', 1.2);
    stroke(context, [[63, 42], [81, 42]], '#8eae81', 1.2);
    const swing = strong ? 48 : 84;
    stroke(context, [[72, 53], [swing, 26]], '#ffdf83', 3.3);
    oval(context, swing, 26, 4.3, 4, '#f9f69d', '#715840');
    stroke(context, [[56, 56], [89, 56]], '#fcdda0', 2.4);
  }

  function drawMetronity(context, strong) {
    if (strong) {
      const gold = '#ffdf88';
      shape(context, path => path.arc(72, 28, 30, 3.47, 5.96), null, '#c5f59f', 2.5);
      stroke(context, [[21, 59], [22, 42], [32, 39], [32, 55]], gold, 3.5);
      oval(context, 17, 60, 6, 4, gold, null, -.42);
      oval(context, 28, 57, 6, 4, gold, null, -.42);
      stroke(context, [[118, 55], [117, 37], [126, 42]], gold, 3.5);
      oval(context, 113, 57, 6, 4, gold, null, -.42);
      spark(context, 124, 79, 8, '#f4fca5');
    }
    badge(context, 78, palette.metronity, strong);
    polygon(context, [[32, 63], [37, 55], [59, 54], [72, 55], [85, 54], [107, 55], [112, 63],
      [86, 65], [72, 62], [58, 65]], '#29665a', ink, 2.4);
    stroke(context, [[38, 59], [59, 58], [72, 60], [85, 58], [106, 59]], '#f7d99c', 2.1);
    metronome(context, strong);
    face(context, 78, strong, '#eeffba');
    polygon(context, [[50, 111], [63, 111], [61, 120], [49, 118]], '#e9bc69', '#734e44', 1.7);
    polygon(context, [[94, 111], [81, 111], [83, 120], [95, 118]], '#e9bc69', '#734e44', 1.7);
  }

  const portraits = {prismity: drawPrismity, polarity: drawPolarity, metronity: drawMetronity};

  function draw(context, key, phase = 1, size = 144) {
    if (!Object.hasOwn(portraits, key)) return;
    context.save();
    context.clearRect(0, 0, size, size);
    context.scale(size / 144, size / 144);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    portraits[key](context, phase === 2);
    context.restore();
  }

  window.TicketLimitedArt = {draw};
})();
