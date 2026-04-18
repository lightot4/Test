const assert = require("assert");
const { parseListingBlock, shouldExcludeText, splitListingBlocks, parseStartLine } = require("../parser.js");

const sample = `2026.04.20
2일전
아파트
동부산3계 2023-564
부산 해운대구 재송동 380-1 센텀동부센트레빌 104동 4층 402호 [해운대로161번길 12]
건물 117㎡ (36평) [45평형]  l   토지 54㎡ (16평)
730,000,000
730,000,000
771,000,000
690,000,000
진행
(100%)
236
(1회)
· 세대조사
· 건축물대장
· 답사사진
· GGTip`;

const parsed = parseListingBlock(sample);
assert.equal(parsed.매각기일, "2026.04.20");
assert.equal(parsed.용도, "아파트");
assert.equal(parsed.법원계, "동부산3계");
assert.equal(parsed.사건번호, "2023-564");
assert.equal(parsed.소재지, "부산 해운대구 재송동 380-1 센텀동부센트레빌 104동 4층 402호");
assert.equal(parsed.도로명주소, "해운대로161번길 12");
assert.equal(parsed["건물㎡"], "117");
assert.equal(parsed.토지평, "16");
assert.equal(parsed.평형표기, "45평형");
assert.equal(parsed.감정가, "730000000");
assert.equal(parsed.최저가, "730000000");
assert.equal(parsed.가격3, "771000000");
assert.equal(parsed.가격4, "690000000");
assert.equal(parsed.상태, "진행");
assert.equal(parsed.비율, "100%");
assert.equal(parsed.조회수, "236");
assert.equal(parsed.유찰회수, "1회");
assert.equal(parsed.추가정보, "세대조사|건축물대장|답사사진|GGTip");

const fallbackStart = parseStartLine("2026.04.17 아파트 수원1계 2024-12345 소재지 경기 수원시");
assert.equal(fallbackStart.사건번호, "2024-12345");
assert.equal(fallbackStart.법원계, "수원1계");

const concatenated = `검색조건 정렬방식\n2026.04.17 / 아파트 / 수원1계 / 2023-12226\n...\n2026.04.17 / 아파트 / 수원1계 / 2024-101796`;
const blocks = splitListingBlocks(concatenated);
assert.equal(blocks.length, 2);

assert.equal(shouldExcludeText("검색조건 정렬방식 고객센터 총 3,440건 function submit_page()"), true);
assert.equal(shouldExcludeText("2026.04.20 아파트 수원1계 2024-1234"), false);

console.log("parser tests passed");
