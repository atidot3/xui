-- Describe this function...
function Init()
  numbers = {'1000'}
  time = os.date('%Y-%m-%d_%H-%M-%S', os.time(time))
  logdirectory = table.concat({'/usr/local/freeswitch/log/GeneralElectric/', time, '/'})
  logfile = table.concat({logdirectory, 'GeneralElectric', time, '.log'})
end



tts_engine = "tts_commandline"
tts_voice = "Ting-Ting"
session:set_tts_params(tts_engine, tts_voice)
session:setVariable("tts_engine", tts_engine)
session:setVariable("tts_voice", tts_voice)
session:answer()
Init()
os.execute("mkdir -p " .. logdirectory);
file = io.open(logfile, 'a')
if file ~= nil then
	file:write(os.date( "%d/%m/%Y %H:%M:%S", os.time()) .. " " .. 'Démarrage du script GE.'.. '\n');
	file:close();
end
session:execute("playback", 'tone_stream://%(500,500,480,620)')
file = io.open(logfile, 'a')
if file ~= nil then
	file:write(os.date( "%d/%m/%Y %H:%M:%S", os.time()) .. " " .. 'BIP joué.'.. '\n');
	file:close();
end
session:recordFile('/usr/local/freeswitch/sounds/alarm.wav', 99999, 9999, 99999)file = io.open(logfile, 'a')
if file ~= nil then
	file:write(os.date( "%d/%m/%Y %H:%M:%S", os.time()) .. " " .. 'Enregistrement de fichier audio terminé.'.. '\n');
	file:close();
end
for _, i in ipairs(numbers) do
  session:execute("lua", (table.concat({'poc.lua ', session:getVariable("caller_id_number"), ' ', i, ' /usr/local/freeswitch/sounds/alarm.wav ', logdirectory})))
end

session:execute("record_session", '/usr/local/freeswitch/sounds/alarm.wav')

