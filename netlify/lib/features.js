// netlify/lib/features.js
// 서버 쪽 기능 스위치.
//
// ★ 2026-08-27: 로고 생성과 메뉴판 생성을 내린다.
//   품질이 판매할 수준에 못 미친다는 판단이고, 브랜드보스(selling-brand-mvp)에서
//   내린 것과 같은 결정이다. 코드는 지우지 않는다 — 되살릴 때 스위치만 켜면 된다.
//
//   이 저장소에서는 두 함수가 화면 어디에서도 호출되지 않는다(포크 잔재다).
//   그래서 "화면에서 안 부르니 괜찮다"고 넘기기 쉬운데, 그게 아니다.
//   netlify.toml이 두 함수의 timeout을 잡고 있어 둘 다 배포되어 살아 있고,
//   requireUser 같은 인증도 없다. 즉 URL을 아는 누구나 Gemini/FLUX 비용을
//   그대로 태울 수 있는 상태였다. 화면이 아니라 여기서 막아야 하는 이유다.
//
//   되살리려면 Netlify 환경변수를 켠다.
//     FEATURE_LOGO_GENERATION=true
//     FEATURE_MENU_GENERATION=true
//   (브랜드보스와 스위치 이름·환경변수를 일부러 똑같이 맞췄다.)
export const LOGO_GENERATION_ENABLED = process.env.FEATURE_LOGO_GENERATION === 'true';
export const MENU_GENERATION_ENABLED = process.env.FEATURE_MENU_GENERATION === 'true';
