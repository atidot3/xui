
-- lecture d'un TTS et stockage en cache
function play_TTS_with_cache(lang,voice,text)
	cacheFilename = "/tmp/ttscache-" .. freeswitch.API():execute( " md5",lang .. "_" .. voice .. "_" .. text ) .. ".wav";

	file, errMsg = io.open( cacheFilename, "r" );
	if not file then
		--pas de fichier, on stocke le résultat en même temps qu'on le joue	
		session:setVariable("RECORD_STEREO", "false");
		session:setVariable("RECORD_WRITE_ONLY", "true");

		session:execute("record_session", cacheFilename);

		session:set_tts_params("unimrcp:acapela-mrcp2", voice);
		session:speak("{speech-language=" .. lang .. "}" .. text);

		session:execute("stop_record_session", cacheFilename);
		--session:consoleLog("info", "play_TTS_with_cache(".. lang .. ", " .. voice .. ", " .. text .. ") => generated in " .. cacheFilename  .. "\n");
	else
		--le fichier existe, on le joue
		session:consoleLog("info", "play_TTS_with_cache(".. lang .. ", " .. voice .. ", " .. text .. ") => already cached in " .. cacheFilename  .. "\n");
		--session:streamFile(cacheFilename);
	end
end

function play_TTS(lang,voice,text)

		session:set_tts_params("unimrcp:acapela-mrcp2", voice);
		session:speak("{speech-language=" .. lang .. "}" .. text);
		session:consoleLog("info", "play_TTS(".. lang .. ", " .. voice .. ", " .. text .. ")\n");
end

-- récupération de l'index des appels de sipp (dans le call_id)
function get_sipp_call_index()
	sipCallId = session:getVariable("sip_call_id");
	session:consoleLog("notice", "playtts.lua: sip_call_id is " .. sipCallId .. "\n");

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
		recordFilename = "/tmp/call-playtts-" .. sipCallId .. ".wav";
		session:consoleLog("notice", "playtts.lua: recording to " .. recordFilename .. "\n");
		session:execute("record_session", recordFilename);
	end
end

 



session:answer();
start_record_if_needed(50);

play_TTS("fr-FR", "Alice8k", "il est ".. os.date("%H:%M") ..". appuyez sur la touche 1 de votre téléphone, puis après le starwars, appuyez sur dièse avant de raccrocher.");

session:getDigits(1, "", 10000);

session:streamFile("/home/hdeprez/Starwars.wav");

session:getDigits(1, "", 10000);

session:sleep(3000);
