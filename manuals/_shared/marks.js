'use strict';

const DATA = {
  substrate: {
    name: 'Agent Substrate',
    source: 'https://github.com/agent-substrate/substrate logo/ate-logo.svg',
    note: 'Apache-2.0 or CC-BY-4.0. Designed by Nan Hockin and donated to the project.',
    h: 785,
    ink: '545 13 617 46 674 97 712 161 727 231 719 305 688 372 638 429 687 433 721 366 738 354 757 382 757 446 773 441 801 420 824 383 826 300 847 301 870 332 876 405 839 482 778 530 694 552 748 596 798 609 854 595 910 541 927 556 917 595 880 634 826 659 766 667 712 661 654 639 550 556 570 679 585 643 619 627 654 643 674 678 676 716 666 746 643 771 613 784 550 775 486 733 453 684 436 607 417 670 385 719 336 752 283 763 247 752 225 724 221 682 241 650 174 669 108 665 50 635 27 591 37 541 73 512 109 513 141 538 141 575 98 592 119 600 184 584 244 527 153 512 57 445 35 391 54 321 41 296 45 275 77 265 110 288 120 397 139 353 170 336 182 352 182 410 207 422 246 425 204 371 178 299 176 224 200 151 247 86 306 41 384 9 467 0;932 197 949 210 949 285 936 304 913 309 832 293 809 278 805 258 822 201 857 182;125 123 146 192 140 213 116 225 32 229 10 221 0 204 1 145 30 119;105 197 126 214 135 306 119 331 54 337 31 320 22 226 32 207 50 200;901 275 916 300 900 392 875 413 824 403 806 378 824 282 858 265;999 480 997 501 966 552 944 550 878 505 879 487 905 448 927 437;953 520 959 544 922 610 895 619 860 599 853 574 891 506 922 502;953 571 956 603 929 610 841 561 837 531 868 523',
    light: '364 271 350 304 317 318 283 304 269 271 283 237 317 223 350 237;617 269 603 303 569 317 535 303 521 269 535 236 569 222 603 236;473 292 452 308 433 305 420 285 421 246 474 241',
  },
  kubernetes: {
    name: 'Kubernetes',
    source: 'https://github.com/kubernetes/kubernetes logo/logo.svg',
    note: 'Apache-2.0 or CC-BY-4.0. A trademark of The Linux Foundation, used under the Linux Foundation trademark usage guidelines.',
    h: 970,
    ink: '529 6 897 188 912 217 998 590 997 624 986 646 745 945 710 968 307 970 274 962 14 646 2 620 2 590 98 194 123 173 497 0;500 127 480 144 485 209 477 233 382 259 304 317 280 308 233 264 206 268 207 295 261 332 275 353 237 441 233 540 211 553 149 562 134 578 137 594 153 602 218 583 243 585 290 672 363 735 359 760 326 818 341 843 363 834 386 775 404 755 500 773 596 755 613 773 638 834 663 841 673 816 641 760 638 735 712 671 758 585 782 583 844 602 866 586 853 562 789 552 768 540 763 443 724 353 739 331 792 295 794 268 767 263 720 307 696 317 617 259 523 233 515 209 520 144;474 288 468 398 457 413 438 412 349 348 404 309;526 288 594 308 651 349 562 412 543 413 532 397;316 389 398 462 404 481 390 495 286 525 290 454;683 389 710 455 715 525 609 494 596 480 602 462;483 468 517 468 538 494 530 526 500 541 470 526 462 494;591 557 703 575 669 637 617 684 574 579 577 564;409 557 423 564 426 579 384 684 332 638 297 576;499 602 517 611 569 707 498 718 431 707 484 611',
  },
  envoy: {
    name: 'Envoy',
    source: 'https://github.com/cncf/artwork projects/envoy/icon/black/envoy-icon-black.svg',
    note: 'CNCF artwork, used under the Linux Foundation trademark usage guidelines.',
    h: 746,
    ink: '313 399 314 460 250 420 249 360;404 610 346 574 345 515 402 551;206 689 271 662 329 698 222 744 201 744 19 633 9 624 5 610 0 428 2 418 10 410 127 359 128 419 58 449 61 600;674 356 679 574 676 576 612 537 608 367 441 264 439 201 446 198 658 329 670 341;422 654 509 617 576 659 440 717 422 719 407 714 175 570 165 560 160 545 154 303 156 291 165 282 309 220 310 290 221 329 226 532;973 189 988 203 993 221 1000 529 995 546 982 556 691 681 674 683 656 676 360 493 345 476 342 462 335 154 339 138 351 128 643 2 659 0 678 7;674 608 923 500 917 234 661 75 411 183 418 449',
  },
  postgresql: {
    name: 'PostgreSQL',
    source: 'https://wiki.postgresql.org/wiki/Logo PostgreSQL_logo.3colors.svg',
    note: 'A trademark of the PostgreSQL Community Association, used to name the project.',
    h: 1037,
    ink: '998 642 996 657 934 702 785 722 747 936 713 993 632 1032 593 1035 560 1024 537 999 516 942 511 784 493 705 452 744 408 761 336 757 300 734 311 718 397 690 431 651 430 628 388 627 347 609 234 734 202 748 156 726 114 667 56 519 4 295 5 182 37 93 94 42 189 17 286 24 391 54 485 16 611 22 694 4 765 2 845 17 905 44 983 118 993 155 992 226 943 416 835 625 879 649 971 641',
    line: '499 680 510 958 547 1017 601 1037 689 1018 738 974 757 910 784 696;390 51 238 16 115 30 72 53 37 91 12 146 0 219 7 313 46 485 88 611 141 708 185 744 217 742 343 611;611 21 737 0 839 14 921 54 987 127 991 225 960 363 908 493 834 623;834 623 879 647 999 644 968 680 909 708 828 716 784 699 793 651 834 623 727 430 703 327 719 288 744 270 841 262 818 201 779 140 680 53 610 24 525 12 468 17 401 44 353 89 321 143 297 218 286 315;430 649 393 690 311 717 301 737 331 754 379 761 458 738 494 701 497 670 464 637;427 649 483 454 479 359 457 291 433 273 392 268 339 282 289 310 282 498 296 550 333 598 376 623 427 628;840 267 830 386 838 513 812 585',
    light: '414 307 437 320 412 334 389 313;793 303 770 323 745 309 768 297',
    lw: 32,
  },
  gvisor: {
    name: 'gVisor',
    source: 'https://github.com/google/gvisor website/assets/logos/logo_solo_on_white.svg',
    note: 'From the Apache-2.0 gVisor repository. The mark belongs to its owner, used to name the project.',
    h: 1102,
    ink: '192 289 227 213 291 138 386 65 265 128 212 176 162 241 110 360 155 360 184 376;213 549 199 465 178 431 150 409 117 400 89 406 124 418 149 444 165 484 172 537 166 590 149 631 125 656 90 669 144 669 189 628;995 277 997 328 971 306 939 302 680 313 455 336 412 351 370 382 346 419 334 462 338 674 363 739 411 801 470 849 533 885 598 909 683 923 754 921 832 906 895 878 956 836 962 841 929 899 861 967 803 1001 730 1026 655 1035 590 1031 517 1015 445 987 291 885 347 966 435 1033 534 1074 668 1095 494 1098 385 1073 282 1026 183 951 108 866 55 778 17 672 1 560 4 454 31 336 73 243 136 158 212 90 290 44 369 16 473 1 555 3 626 16 703 45 772 87 843 146 862 167 726 157 585 181 487 227 413 293 560 244 710 216 861 213 964 239',
    soft: '665 882 744 758 794 627 814 489 804 342 950 343 973 429 978 549 962 696 937 792 899 836 836 868 757 884;638 631 611 599 638 566 664 599;508 582 490 537 439 497 480 467 508 412 535 467 576 497 525 537',
  },
  kagent: {
    name: 'kagent',
    source: 'https://github.com/kagent-dev/kagent ui/public/favicon.svg',
    note: 'From the Apache-2.0 kagent repository. A CNCF project, used under the Linux Foundation trademark usage guidelines.',
    h: 755,
    ink: '750 503 625 503 625 378 750 378;500 503 375 503 375 378 500 378;1000 252 1000 629 875 629 875 252 250 252 250 629 750 629 875 629 875 755 250 755 0 503 0 252 125 252 125 126 250 126 250 0 750 0 875 126',
  },
  agentgateway: {
    name: 'agentgateway',
    source: 'https://github.com/agentgateway/agentgateway ui/src/assets/agw-icon.svg',
    note: 'From the Apache-2.0 agentgateway repository. A Linux Foundation project, used under the Linux Foundation trademark usage guidelines.',
    h: 1158,
    ink: '444 277 398 246 367 200 356 144 367 88 398 42 444 11 500 0 557 11 602 42 633 88 645 144 633 200 602 246 557 277 500 288;444 712 398 681 367 635 356 579 367 523 398 477 444 446 500 435 557 446 602 477 633 523 645 579 633 635 602 681 557 712 500 723;594 437 623 503 500 579 377 503 407 437 417 361 407 286 377 219 500 144 623 219 594 286 583 361;799 494 753 463 722 417 711 361 722 305 753 260 799 229 855 217 912 229 958 260 989 305 1000 361 989 417 958 463 912 494 855 505;799 929 753 898 722 853 711 796 722 740 753 695 799 664 855 652 912 664 958 695 989 740 1000 796 989 853 958 898 912 929 855 941;949 654 979 721 855 797 732 721 762 654 773 579 762 504 732 437 855 361 979 437 949 504 938 579;88 494 42 463 11 417 0 361 11 305 42 260 88 229 145 217 201 229 247 260 278 305 289 361 278 417 247 463 201 494 145 505;88 929 42 898 11 853 0 796 11 740 42 695 88 664 145 652 201 664 247 695 278 740 289 796 278 853 247 898 201 929 145 941;238 654 268 721 145 797 21 721 51 654 62 579 51 504 21 437 145 361 268 437 238 504 227 579;444 1147 398 1116 367 1070 356 1014 367 958 398 912 444 881 500 870 557 881 602 912 633 958 645 1014 633 1070 602 1116 557 1147 500 1158',
  },
};

const r1 = value => Math.round(value * 10) / 10;
const short = value => String(value).replace(/^(-?)0\./, '$1.');

function relative(points, closed) {
  let d = `M${points[0][0]} ${points[0][1]}l`;
  let previous = points[0];
  let lead = true;
  for (const point of points.slice(1)) {
    const dx = r1(point[0] - previous[0]);
    const dy = r1(point[1] - previous[1]);
    if (!dx && !dy) continue;
    for (const value of [dx, dy]) {
      const token = short(value);
      d += (lead || token.startsWith('-') ? '' : ' ') + token;
      lead = false;
    }
    previous = point;
  }
  return d + (closed ? 'z' : '');
}

function outline(text, map, closed = true) {
  return text.split(';').map(ring => {
    const n = ring.split(' ').map(Number);
    const points = [];
    for (let i = 0; i < n.length; i += 2) points.push(map(n[i], n[i + 1]));
    return relative(points, closed);
  }).join('');
}

function layers(data, map, k) {
  const out = [];
  if (data.ink) out.push({ role: 'ink', d: outline(data.ink, map) });
  if (data.soft) out.push({ role: 'soft', d: outline(data.soft, map) });
  if (data.line) out.push({ role: 'line', d: outline(data.line, map, false), width: r1(data.lw * k) });
  if (data.light) out.push({ role: 'light', d: outline(data.light, map) });
  return out;
}

function define(id, data) {
  return {
    id,
    name: data.name,
    source: data.source,
    note: data.note,
    ratio: data.h / 1000,
    onFace(view, origin, u, v, size) {
      const k = size / 1000;
      return layers(data, (a, b) => view.P(origin[0] + (u[0] * a + v[0] * b) * k, origin[1] + (u[1] * a + v[1] * b) * k, origin[2] + (u[2] * a + v[2] * b) * k).map(r1), k);
    },
    onFloor(view, center, size) {
      const k = size / 1000 / Math.SQRT2;
      const half = data.h / 2;
      return layers(data, (a, b) => view.P(center[0] + (a - 500) * k + (b - half) * k, center[1] - (a - 500) * k + (b - half) * k, center[2] || 0).map(r1), k);
    },
    flat(x, y, size) {
      const k = size / 1000;
      return layers(data, (a, b) => [r1(x + a * k), r1(y + b * k)], k);
    },
  };
}

const MARKS = Object.fromEntries(Object.entries(DATA).map(([id, data]) => [id, define(id, data)]));

function mark(id) {
  const found = typeof id === 'string' ? MARKS[id] : id;
  if (!found || !found.onFace) throw new Error(`marks: unknown mark ${id}`);
  return found;
}

function stamp(f, drawn, hue) {
  for (const layer of drawn) {
    if (layer.role === 'ink') f.mark(layer.d, { hue });
    if (layer.role === 'soft') f.mark(layer.d, { hue, opacity: 0.55 });
    if (layer.role === 'line') f.path(layer.d, { hue: 'paper', head: false, width: layer.width });
    if (layer.role === 'light') f.mark(layer.d, { hue: 'paper' });
  }
  return f;
}

module.exports = { MARKS, mark, stamp };
