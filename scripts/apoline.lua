--function play_TTS_with_cache(lang,voice,text)
--	cacheFilename = session:execute( "md5", lang .. "_" .. voice .. "_" .. msg );
	


--end


session:answer();

--sons
welcomeSoundFile = "/usr/share/freeswitch/sounds/fr-FR_welcome.wav";
starwarsSoundFile = "/home/hdeprez/Starwars.wav";

--voix + textes
voiceFR = "Alice8k";
choiceFR = "il est ".. os.date("%X") .. ". Site de SELECTARC. Merci de prononcer le nom du service ou du contact que vous voulez joindre.";
grammarFR = "apoline-fr_FR";
resultNotFoundFR = "impossible de reconnaitre votre demande.";
resultFoundPart1FR = "nous avons reconnu ";
resultFoundPart2FR = " avec un niveau de confiance de ";
byeFR = "à bientôt.";

voiceEN = "Rachel8k";
choiceEN = "it is ".. os.date("%X") .. ". SELECTARC Site. Please tell the service or contact name you want to join.";
grammarEN = "apoline-en_GB";
grammarEN = "apoline-fr_FR";
resultNotFoundEN = "unable to recognise your demand.";
resultFoundPart1EN = "we have recognized ";
resultFoundPart2EN = " with a confidence level of ";
byeEN = "goodbye.";


--choix de la langue (FR par défaut)

voice = voiceFR;
choice = choiceFR;
grammar = grammarFR
resultNotFound = resultNotFoundFR;
resultFoundPart1 = resultFoundPart1FR;
resultFoundPart2 = resultFoundPart2FR;
bye = byeFR

digit = session:playAndGetDigits (1, 1, 1, 6000, "", welcomeSoundFile, "", ".*");

if digit == "1" then
	voice = voiceEN;
	choice = choiceEN;
	grammar = grammarEN;
	resultNotFound = resultNotFoundEN;
	resultFoundPart1 = resultFoundPart1EN;
	resultFoundPart2 = resultFoundPart2EN;
	bye = byeEN
end


--paramétrage tts
session:set_tts_params("unimrcp:acapela-mrcp2", voice);

--reconnaissance vocale avec du tts + barge in
sayParams = "say:unimrcp:" .. voice .. ":" .. choice;
detectParams = "detect:unimrcp {start-input-timers=false,define-grammar=true,no-input-timeout=20000,recognition-timeout=20000}" .. grammar;

session:setVariable("play_and_detect_speech_close_asr", "true");
session:execute("play_and_detect_speech", sayParams  .. " " .. detectParams);

--interpretation des résultats
xml = session:getVariable('detect_speech_result');
session:consoleLog("notice", xml);

if (xml == nil) then
	session:speak(resultNotFound);
else
	confidence = string.match(xml, 'interpretation confidence="(%d+)');
	name = string.match(xml, "<name>([^<]+)</name>");
	session:consoleLog("crit", resultFoundPart1 .. name .. resultFoundPart2 .. confidence); 
	session:speak(resultFoundPart1 .. name .. resultFoundPart2 .. confidence); 
end


session:speak(bye); 


--session:set_tts_params("unimrcp:acapela-mrcp2", "Ryan8k");
--session:speak("{speech-language=en-US}Are the archduchess socks dry, super-dry?");

--session:set_tts_params("unimrcp:acapela-mrcp2", "Sharon8k");
--session:speak("{speech-language=en-US}Are the archduchess socks dry, super-dry?");

--session:set_tts_params("unimrcp:acapela-mrcp2", "Peter8k");
--session:speak("{speech-language=en-GB}Are the archduchess socks dry, super-dry?");

--session:set_tts_params("unimrcp:acapela-mrcp2", "Rachel8k");
--session:speak("{speech-language=en-GB}Are the archduchess socks dry, super-dry?");

--session:set_tts_params("unimrcp:acapela-mrcp2", "Alice8k");
--session:speak("{speech-language=fr-FR}les chaussettes de l'archiduchesse sont-elles sèches, archisèches?");

--session:set_tts_params("unimrcp:acapela-mrcp2", "Bruno8k");
--session:speak("{speech-language=fr-FR}les chaussettes de l'archiduchesse sont-elles sèches, archisèches?");

--session:execute("playback","/home/hdeprez/45s.wav");

--session:execute("playback","/home/hdeprez/Starwars.wav");

session:sleep(1000);
