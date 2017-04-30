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

content_type("text/xml")
require 'xdb'
xdb.bind(xtra.dbh)
require 'xwechat'
require 'm_dict'


get('/xswitch/tickets', function(params)

	print(env:serialize())

	content_type("application/json")
	tickets = {
		{
			id = 1,
			subject = "test1",
			content = "test1"
		},
		{
			id = 2,
			subject = "test2",
			content = "text2"
		}
	}
	return tickets
end)

-- realm to support multiple wechat accounds, e.g. sipsip, xyt

get('/anyway/:realm', function(params)
	return 	env:getHeader("echostr")
end)

get('/view', function(params)
	content_type("text/html")

	print(env:serialize())

	wechat = m_dict.get_obj('WECHAT')

	ret = xwechat.get_js_access_token('sipsip', wechat.APPID, wechat.APPSEC, env:getHeader("code"))

	jret = utils.json_decode(ret)

	n, user = xdb.find_by_cond("users", {openid = jret.openid})
	local u = user[1]
	if(n > 0) then
		return {"render", "users.html", {name = u.name,password = u.password}}
	else
		return {"render", "jstest.html", {openid = jret.openid}}
	end

end)

post('/bind', function(params)
	content_type("application/json")
	return '{"res":' .. params.request.username .. '}'
end)

post('/jstest', function(params)
	login = env:getHeader("login")
	pass = env:getHeader("pass")
	u_openid = env:getHeader("openid")

	local users = {}
	users.name = login
	users.password = pass
	n, user = xdb.find_by_cond("users", users)
	local u = user[1]
	if (n > 0) then
		xdb.update_by_cond("users",{id = u.id}, {openid = u_openid})
		redirect("http://www.baidu.com")
	else
		redirect("http://www.360.com")
	end
end)

get('/:realm/tickets', function(params)
	print(env:serialize())
	print(serialize(params))
	content_type("text/html")

	realm = params.realm
	code = env:getHeader("code")

	wechat = m_dict.get_obj('WECHAT/' .. realm)

	ret = xwechat.get_js_access_token(realm, wechat.APPID, wechat.APPSEC, code)
	-- print(ret)
	jret = utils.json_decode(ret)

	if jret.openid then
		n, wechat_user = xdb.find_by_cond("wechat_users", {openid = jret.openid})
	else
		n, wechat_user = xdb.find_by_cond("wechat_users", {code = code})
	end

	if (n > 0) then
		local u = wechat_user[1]
		print(serialize(u))

		user1 = {
			id = u.id,
			code = code
		}

		xdb.update("wechat_users", user1)

		if u.user_id and not (u.user_id == '') then
			n, tickets = xdb.find_all("tickets")

			return {"render", "wechat/tickets.html", {tickets = tickets}}
		else
			return {"render", "wechat/login.html", u}
		end
	else
		ret = xwechat.get_sns_userinfo(jret.openid, jret.access_token)
print(ret)
		user_info = utils.json_decode(ret)
		user_info.privilege = nil
		user_info.language = nil
		wechat_user_id = xdb.create_return_id("wechat_users", user_info)
		wechat_user = {
			id = wechat_user_id,
			nickname = user_info.nickname,
			headimgurl = user_info.headimgurl
		}
		return {"render", "wechat/login.html", wechat_user}
	end
end)

post('/:realm/tickets', function(params) -- login
	print(env:serialize())
	print(serialize(params))
	wechat = m_dict.get_obj('WECHAT/' .. params.realm)
	appid = wechat.APPID

	login = env:getHeader("login")
	pass = env:getHeader("pass")
	wechat_user_id = env:getHeader("id")

	n, users = xdb.find_by_cond("users", {extn = login, password = pass})

	if n > 0 then
		user = users[1]
		wechat_users = {
			id = wechat_user_id,
			user_id = user.id
		}
		xdb.update("wechat_users", wechat_users)
		redirect_uri = "http%3A//shop.x-y-t.cn/seven" -- TODO: hardcoded
		redirect_uri = xwechat.redirect_uri(appid, redirect_uri, "200")
		redirect(redirect_uri)
	else
		redirect_uri = "http%3A//shop.x-y-t.cn/seven" -- TODO: hardcoded
		redirect_uri = xwechat.redirect_uri(appid, redirect_uri, "403")
		redirect(recirect_uri)
	end
end)

get('/:realm', function(params)
	signature = env:getHeader("signature")
	timestamp = env:getHeader("timestamp")
	nonce = env:getHeader("nonce")
	echostr = env:getHeader("echostr")

	-- wechat = m_dict.get_obj(params.realm)
	wechat = m_dict.get_obj('WECHAT')

	print(serialize(wechat))

	obj = {}

	print(env:serialize())

	table.insert(obj, wechat.TOKEN)
	table.insert(obj, nonce)
	table.insert(obj, timestamp)

	table.sort(obj, function(a, b)
		return a < b
	end)

	print(serialize(obj))

	str = obj[1] .. obj[2] .. obj[3]
	sha1 = require("sha1")
	sha = sha1(str)
	print(sha)

	if (sha == signature) then
		return echostr
	else
		return 500
	end
end)

post('/:realm', function(params)
	print(serialize(params))
	print(env:serialize())
	req = stream:read()
	print(req)
	xml = utils.xml(req)

	FromUserName = xml:val("FromUserName")
	ToUserName = xml:val("ToUserName")
	CreateTime = xml:val("CreateTime")
	MsgType = xml:val("MsgType")
	Content = xml:val("Content")

	Reply = "OK"

	response = "<xml>" ..
		"<ToUserName><![CDATA[" .. FromUserName .. "]]></ToUserName>" ..
		"<FromUserName><![CDATA[" .. ToUserName .. "]]></FromUserName>" ..
		"<CreateTime>" .. CreateTime .. "</CreateTime>" ..
		"<MsgType><![CDATA[text]]></MsgType>" ..
		"<Content><![CDATA[" .. Reply .. "]]></Content>" ..
		"<FuncFlag>0</FuncFlag>" ..
		"</xml>"
	return response
end)
