tts_engine = "tts_commandline"
tts_voice = "Ting-Ting"
session:set_tts_params(tts_engine, tts_voice)
session:setVariable("tts_engine", tts_engine)
session:setVariable("tts_voice", tts_voice)
session:answer()
numbers = {'user/1001'}
os.execute("mkdir -p /usr/local/freeswitch/log/GeneralElectric")
session:execute("playback", 'tone_stream://%(500,500,480,620)')
session:execute("record", (tostring('/tmp/records/alerte.wav')))
for _, i in ipairs(numbers) do
  session:execute("lua", (tostring('poc.lua ')))
end

