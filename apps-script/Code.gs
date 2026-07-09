const SCRIPT_PROP = PropertiesService.getScriptProperties();

function setup() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  SCRIPT_PROP.setProperty("key", doc.getId());
}

function doGet(e) {
  const doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
  const sheet = doc.getSheetByName("DB") || doc.insertSheet("DB");
  
  let data = sheet.getRange("A1").getValue();
  if (!data) data = JSON.stringify({ matches: [], bets: {}, claims: {}, config: {} });
  
  return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
  const sheet = doc.getSheetByName("DB") || doc.insertSheet("DB");
  
  let currentData = sheet.getRange("A1").getValue();
  let db = currentData ? JSON.parse(currentData) : { matches: [], bets: {}, claims: {}, config: {} };
  
  try {
    const payload = JSON.parse(e.postData.contents);
    
    if (payload.action === "updateMatches") db.matches = payload.data;
    if (payload.action === "updateBets") db.bets = payload.data;
    if (payload.action === "updateClaims") db.claims = payload.data;
    if (payload.action === "updateConfig") db.config = payload.data;
    
    sheet.getRange("A1").setValue(JSON.stringify(db));
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}