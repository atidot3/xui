--[[ theses variables are globals ==================================================================== ]]

--[[ config ]]
local CallerAddress= argv[1];
local CalledAddress = argv[2];
local Message = argv[3];
local recordsDirectory = argv[4];
local recordLogFile = recordsDirectory
local maxTry = 5
-- [[ The script do not edit after this line ======================================================== ]] 

local strLog = {}

function Log(newStr)
	strLog[#strLog+1] = os.date( "%d/%m/%Y %H:%M:%S", os.time()) .. " " .. newStr .. "\n"
	freeswitch.consoleLog("info", "tel4bManager call: " .. newStr .. "\n")
end

function CompleteLog()
	local str = ""
	for i = 1, #strLog do
		str = str .. strLog[i]
	end
	return str
end

function PlayMessage(session)
	Log("Lancement du message d'alerte")
	session:streamFile(Message)
	session:streamFile(Message)
	session:streamFile(Message)
end

function sleep(n)
  os.execute("sleep " .. tonumber(n))
end

function Call(dial)
	local dialled_session = freeswitch.Session("{ignore_early_media=true, origination_caller_id_number=" .. CallerAddress ..", origination_caller_id_name=" .. CallerAddress .. "}" .. dial, session)
	local hcause = ''
	if dialled_session:ready() then
		recordLogFile = recordLogFile .. CalledAddress .. "_" .. dialled_session:get_uuid();
		Log("Communication en cours avec " .. CalledAddress .. " (session: ".. dialled_session:get_uuid() .. ")")
		hcause = "NORMAL_CLEARING";
		PlayMessage(dialled_session)
	else
		hcause = dialled_session:hangupCause()
		recordLogFile = recordLogFile .. CalledAddress .. "_nores";
		Log("Erreur lors de la connection avec " .. CalledAddress .. " : " .. hcause)
	end
	return hcause
end

--[ MAIN SCRIPT ]
local Gateway= "user"
local dial = Gateway .. "/" .. CalledAddress
for i = 1, maxTry do
	Log("Appel du contact: " .. CalledAddress)
	local result = Call(dial)
	Log("Resultat de l'appel: " .. result)
	if result == "NORMAL_CLEARING" then
		break;
	end
	sleep(15);
end

-- Write in log if possible
if recordLogFile ~= '' then
	file = io.open (recordLogFile .. '.log' , 'a')
	if file ~= nil then
		file:write(CompleteLog())
		file:close();
	end
end