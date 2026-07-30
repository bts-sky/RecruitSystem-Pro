/**
 * upload.js v1.1.0 (basic placeholder)
 */
window.RecruitUpload=(function(){
 const state={photo:null,resume:null,certificates:[]};
 return {
  buildUploadPayload(){return {...state};},
  getMetadata(){return {version:"1.1.0",module:"RecruitUpload"};}
 };
})();
