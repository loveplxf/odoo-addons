# -*- coding: utf-8 -*-
import json
from odoo import http, _, exceptions
from odoo.http import request
from .serializers import Serializer

from xmlrpc import client
import requests
import random


def get_json_payload(service, method, *args):
    return json.dumps({
        "jsonrpc": "2.0",
        "method": 'call',
        "params": {
            "service": service,
            "method": method,
            "args": args
        },
        "id": random.randint(0, 100000000),
    })


class WechatAPI(http.Controller):

    @http.route(
        '/get_company/',
        type='http', auth='public', methods=["GET"], csrf=False)
    def get_company(self):
        records = request.env['res.company'].sudo().search([])
        query = "{id, sequence, name}"
        serializer = Serializer(records, query, many=True)
        data = serializer.data
        res = {
            "count": len(records),
            "result": data
        }
        return http.Response(
            json.dumps(res),
            status=200,
            mimetype='application/json'
        )

    @http.route(
        '/get_department/',
        type='http', auth='public', methods=["GET"], csrf=False)
    def get_department(self, **params):
        records = request.env['hr.department'].sudo().search([])
        if "filter" in params:
            filters = json.loads(params["filter"])
            records = request.env['hr.department'].sudo().search(filters, order="complete_name")
        query = "{id, name, complete_name, company_id}"
        serializer = Serializer(records, query, many=True)
        data = serializer.data
        res = {
            "count": len(records),
            "result": data
        }
        return http.Response(
            json.dumps(res),
            status=200,
            mimetype='application/json'
        )

    @http.route(
        '/validate_exist/',
        type='http', auth='public', methods=["GET"], csrf=False)
    def validate_exist(self, **params):
        if "login" in params:
            login = params["login"]
            records = request.env['res.users'].sudo().search([["login", "=", login]])
        query = "{id, name, login}"
        serializer = Serializer(records, query, many=True)
        data = serializer.data
        res = {
            "count": len(records),
            "result": data
        }
        return http.Response(
            json.dumps(res),
            status=200,
            mimetype='application/json'
        )

    @http.route(
        '/register_mp_user/',
        type='json', auth='public', methods=["POST"], csrf=False)
    def register_mp_user(self, *args, **post):

        try:
            name = post['name']
        except KeyError:
            msg = "`name` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            phone = post['phone']
        except KeyError:
            msg = "`phone` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            password = post['password']
        except KeyError:
            msg = "`password` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            email = post['email']
        except KeyError:
            msg = "`email` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            company_id = post['company_id']
        except KeyError:
            msg = "`company_id` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            department_id = post['department_id']
        except KeyError:
            msg = "`name` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        try:
            openid = post['openid']
        except KeyError:
            msg = "`openid` parameter is not found on POST request body"
            raise exceptions.ValidationError(msg)

        # 设置默认值
        tz = "Asia/Shanghai"
        groups_id = request.env.ref('base.group_user').ids
        # groups_id = [request.env.ref('base.group_user').id]

        # 创建user
        user_data = {
            "login": phone,
            "password": password,
            "name": name,
            "company_id": company_id,
            "company_ids": [company_id],
            "phone": phone,
            "mobile": phone,
            "email": email,
            "groups_id": groups_id,
            "tz": tz
        }
        user = request.env['res.users'].sudo().create(user_data)
        request.env.cr.commit()

        # 创建employee
        employee_data = {
            "name": name,
            "company_id": company_id,
            "department_id": department_id,
            "user_id": user.id,
            "work_phone": phone,
            "mobile_phone": phone,
            "work_email": email,
            "tz": tz
        }
        employee = request.env['hr.employee'].sudo().create(employee_data)
        request.env.cr.commit()

        # 创建apikey
        env = request.env(user=user)
        try:
            env['res.users.identitycheck'].create({
                'password': password
            }).run_check()
        except:
            pass
        desc = env['res.users.apikeys.description'].create({
            'name': '微信小程序对接',
        }).make_key()

        apikey = desc['context']['default_key']

        # 关联OpenID
        employee.write({
            "visa_no": openid,
            "permit_no": apikey
        })

        return {'user_id': user.id, 'employee_id': employee.id, 'apikey': apikey}
