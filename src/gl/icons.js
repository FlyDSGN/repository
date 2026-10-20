import backSvg from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import phoneSvg from '@phosphor-icons/core/assets/regular/phone.svg?raw';
import videoSvg from '@phosphor-icons/core/assets/regular/video-camera.svg?raw';
import clipSvg from '@phosphor-icons/core/assets/regular/paperclip.svg?raw';
import micSvg from '@phosphor-icons/core/assets/regular/microphone.svg?raw';
import micFillSvg from '@phosphor-icons/core/assets/fill/microphone-fill.svg?raw';
import smileySvg from '@phosphor-icons/core/assets/regular/smiley.svg?raw';
import searchSvg from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import composeSvg from '@phosphor-icons/core/assets/regular/pencil-simple-line.svg?raw';
import chatsFillSvg from '@phosphor-icons/core/assets/fill/chats-circle-fill.svg?raw';
import gearSvg from '@phosphor-icons/core/assets/regular/gear-six.svg?raw';
import userSvg from '@phosphor-icons/core/assets/regular/user-circle.svg?raw';
import playSvg from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import micOffSvg from '@phosphor-icons/core/assets/fill/microphone-slash-fill.svg?raw';
import screencastSvg from '@phosphor-icons/core/assets/fill/screencast-fill.svg?raw';
import videoFillSvg from '@phosphor-icons/core/assets/fill/video-camera-fill.svg?raw';
import speakerSvg from '@phosphor-icons/core/assets/fill/speaker-high-fill.svg?raw';
import hangupSvg from '@phosphor-icons/core/assets/fill/phone-disconnect-fill.svg?raw';
import eyeSvg from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import bellOffSvg from '@phosphor-icons/core/assets/regular/bell-slash.svg?raw';
import dotsSvg from '@phosphor-icons/core/assets/bold/dots-three-vertical-bold.svg?raw';
import checksSvg from '@phosphor-icons/core/assets/bold/checks-bold.svg?raw';
import desktopSvg from '@phosphor-icons/core/assets/regular/desktop.svg?raw';
import androidSvg from '@phosphor-icons/core/assets/fill/android-logo-fill.svg?raw';
import globeSvg from '@phosphor-icons/core/assets/regular/globe.svg?raw';
import mobileSvg from '@phosphor-icons/core/assets/regular/device-mobile.svg?raw';
import lockSvg from '@phosphor-icons/core/assets/regular/lock-key.svg?raw';
import shieldSvg from '@phosphor-icons/core/assets/regular/shield-check.svg?raw';
import chevronSvg from '@phosphor-icons/core/assets/bold/caret-right-bold.svg?raw';
import signalSvg from '@phosphor-icons/core/assets/fill/cell-signal-full-fill.svg?raw';
import wifiSvg from '@phosphor-icons/core/assets/fill/wifi-high-fill.svg?raw';
import batterySvg from '@phosphor-icons/core/assets/fill/battery-full-fill.svg?raw';
import pinSvg from '@phosphor-icons/core/assets/fill/push-pin-fill.svg?raw';
import robotSvg from '@phosphor-icons/core/assets/regular/robot.svg?raw';
import usersSvg from '@phosphor-icons/core/assets/regular/users-three.svg?raw';
import phoneTabSvg from '@phosphor-icons/core/assets/regular/phone.svg?raw';

const paths = (svg) => [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);

export const ICONS = {
  back: paths(backSvg),
  phone: paths(phoneSvg),
  video: paths(videoSvg),
  clip: paths(clipSvg),
  mic: paths(micSvg),
  micFill: paths(micFillSvg),
  smiley: paths(smileySvg),
  search: paths(searchSvg),
  compose: paths(composeSvg),
  chatsFill: paths(chatsFillSvg),
  gear: paths(gearSvg),
  user: paths(userSvg),
  play: paths(playSvg),
  micOff: paths(micOffSvg),
  screencast: paths(screencastSvg),
  videoFill: paths(videoFillSvg),
  speaker: paths(speakerSvg),
  hangup: paths(hangupSvg),
  eye: paths(eyeSvg),
  bellOff: paths(bellOffSvg),
  dots: paths(dotsSvg),
  checks: paths(checksSvg),
  desktop: paths(desktopSvg),
  android: paths(androidSvg),
  globe: paths(globeSvg),
  mobile: paths(mobileSvg),
  lock: paths(lockSvg),
  shield: paths(shieldSvg),
  chevron: paths(chevronSvg),
  signal: paths(signalSvg),
  wifi: paths(wifiSvg),
  battery: paths(batterySvg),
  pin: paths(pinSvg),
  robot: paths(robotSvg),
  users: paths(usersSvg),
  phoneTab: paths(phoneTabSvg),
};

const cache = new Map();

export function drawIcon(ctx, name, x, y, size, color) {
  if (!cache.has(name)) cache.set(name, ICONS[name].map((d) => new Path2D(d)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 256, size / 256);
  ctx.fillStyle = color;
  for (const p of cache.get(name)) ctx.fill(p);
  ctx.restore();
}
