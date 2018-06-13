--[[ theses variables are globals ==================================================================== ]]

--[[ config ]]
local CallerAddress= argv[1];
local CalledAddress = argv[2];
local Message = argv[3];
local recordLogFile = ''
local recordsDirectory = "/tmp/records/"
-- [[ The script do not edit after this line ======================================================== ]] 

local strLog = {}

function Log(newStr)
	strLog[#strLog+1] = os.date( "%d/%m/%Y %H:%M:%S", os.time()) .. " " .. newStr .. "\n"
	freeswitch.consoleLog("info", "POC: " .. newStr .. "\n")
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
end

--[ MAIN SCRIPT ]

local Gateway= "user"
local dial = Gateway .. "/" .. CalledAddress
Log("Appel du contact: " .. dial)
local dialled_session = freeswitch.Session("{ignore_early_media=true, origination_caller_id_number=" .. CallerAddress ..", origination_caller_id_name=" .. CallerAddress .. "}" .. dial, session)

local hcause = ''
if dialled_session:ready() then
	recordLogFile = recordsDirectory .. dial .. " " .. dialled_session:get_uuid();
	Log("Communication en cours avec " .. dial .. " (session: ".. dialled_session:get_uuid() .. ")")
	PlayMessage(dialled_session)
else
	hcause = dialled_session:hangupCause()
	Log("Erreur lors de la connection avec " .. dial .. " : " .. hcause)
end

-- Write in log if possible
if recordLogFile ~= '' then
	file = io.open (recordLogFile .. '.log' , 'a')
	if file ~= nil then
		file:write(CompleteLog())
		file:close();
	end
end