--[[
/*
 * HTML5 GUI Framework for FreeSWITCH - XUI
 * Copyright (C) 2015-2017, Seven Du <dujinfang@x-y-t.cn>
 *
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is XUI - GUI for FreeSWITCH
 *
 * The Initial Developer of the Original Code is
 * Seven Du <dujinfang@x-y-t.cn>
 * Portions created by the Initial Developer are Copyright (C)
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Seven Du <dujinfang@x-y-t.cn>
 *
 *
 */
]]

action = params:getHeader("Action")
if action == "request-controls" then
	controls = params:getHeader("Controls")
	conference_name = params:getHeader("Conf-Name")
else
	conference_name = params:getHeader("conference_name")
	profile_name = params:getHeader("profile_name")
end

function build_conference_conf(profile_name)
	local settings = ""
	local cond = {realm = 'conference', disabled = 0}

	xdb.find_by_cond("params", cond, 'id', function (row)
		settings = settings .. '<param name ="' .. row.k .. '" value="' .. row.v .. '"/>\n'
	end)

	return [[<profiles><profile name="]] .. profile_name .. '">' .. settings .. [[</profile></profiles>]]
end

function build_controls(name) -- todo: fix hardcoded
	return 	[[<control action="mute" digits="0"/>
		<control action="deaf mute" digits="**"/>
		<control action="vmute" digits="*0"/>
		<control action="vmute snap" digits="*1"/>
		<control action="vmute snapoff" digits="*2"/>
		<control action="mute on" digits="*4"/>
		<control action="mute off" digits="*5"/>
		<control action="energy up" digits="9"/>
		<control action="energy equ" digits="8"/>
		<control action="energy dn" digits="7"/>
		<control action="vol talk up" digits="3"/>
		<control action="vol talk zero" digits="2"/>
		<control action="vol talk dn" digits="1"/>
		<control action="vol listen up" digits="6"/>
		<control action="vol listen zero" digits="5"/>
		<control action="vol listen dn" digits="4"/>
		<control action="hangup" digits="#"/>
	]]
end

function build_control_group(name)
	group = '<caller-controls><group name="' .. name .. '">\n' ..
		build_controls(name) .. "\n" ..
		'</group></caller-controls>\n'

	return group
end

if controls then
	data = build_control_group(controls)
else
	data = build_conference_conf(profile_name)
end

XML_STRING = [[<configuration name="conference.conf" description="Conference Server">
]] .. data .. [[
</configuration>
]]
