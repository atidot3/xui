-- récupération de l'index des appels de sipp (dans le call_id)
function get_sipp_call_index()
	sipCallId = session:getVariable("sip_call_id");
	session:consoleLog("notice", "play.lua: sip_call_id is " .. sipCallId .. "\n");

	indexEndOffset =  string.find(sipCallId, "-");
	if indexEndOffset == nil then
		return 0;
	end
	indexStr = string.sub(sipCallId, 0,  indexEndOffset-1);
	if indexStr == nil then
		return 0;
	end
	return tonumber(indexStr);
end

-- doit on enregistrer ?
function start_record_if_needed(mod)
	id = get_sipp_call_index();
	if id == nil or id % mod == 0 then
		sipCallId = session:getVariable("sip_call_id");
		recordFilename = "/tmp/call-play-" .. sipCallId .. ".wav";
		session:consoleLog("notice", "play.lua: recording to " .. recordFilename .. "\n");
		session:execute("record_session", recordFilename);
	end
end

 
session:answer();
start_record_if_needed(1000);

session:streamFile("/home/hdeprez/Starwars.wav");

session:getDigits(1, "", 10000);

session:sleep(3000);
