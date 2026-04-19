const assert = require("assert");
const { parseListingBlock, parseAddressLine } = require("../parser.js");

const a1 = parseAddressLine("경남 거제시 상동동 475-3 가나마메종 3층 301호 [거제중앙로5길 23]");
assert.equal(a1.소재지, "경남 거제시 상동동 475-3");
assert.equal(a1.물건기본내역, "가나마메종 3층 301호");
assert.equal(a1.도로명주소, "거제중앙로5길 23");

const a2 = parseAddressLine("부산 해운대구 재송동 380-1 센텀동부센트레빌 104동 4층 402호 [해운대로161번길 12]");
assert.equal(a2.소재지, "부산 해운대구 재송동 380-1");
assert.equal(a2.물건기본내역, "센텀동부센트레빌 104동 4층 402호");
assert.equal(a2.도로명주소, "해운대로161번길 12");

const a3 = parseAddressLine("경기 수원시 영통구 영통동 1054-3 한국 214동 4층 405호 [봉영로1770번길 21]");
assert.equal(a3.소재지, "경기 수원시 영통구 영통동 1054-3");
assert.equal(a3.물건기본내역, "한국 214동 4층 405호");
assert.equal(a3.도로명주소, "봉영로1770번길 21");

const a4 = parseAddressLine("충남 천안시 서북구 신당동 468-7 ,468-26 에스씨그린 102동 2층 202호 [천일고2길 113-16]");
assert.equal(a4.소재지, "충남 천안시 서북구 신당동 468-7, 468-26");
assert.equal(a4.물건기본내역, "에스씨그린 102동 2층 202호");
assert.equal(a4.도로명주소, "천일고2길 113-16");

const sample = `2026.04.20\n아파트\n통영6계 2022-24881\n경남 거제시 상동동 475-3 가나마메종 3층 301호 [거제중앙로5길 23]\n건물 139㎡ (42평) l 토지 81㎡ (25평)\n220,000,000\n98,560,000\n기각\n(45%)\n166\n· 세대조사\n· 건축물대장\n· GGTip`;
const parsed = parseListingBlock(sample);
assert.equal(parsed.소재지, "경남 거제시 상동동 475-3");
assert.equal(parsed.물건기본내역, "가나마메종 3층 301호");
assert.equal(parsed.도로명주소, "거제중앙로5길 23");

console.log("parser tests passed");
