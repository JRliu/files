const token = '%[a-f0-9]{2}';
const singleMatcher = new RegExp('(' + token + ')|([^%]+?)', 'gi');
const multiMatcher = new RegExp('(' + token + ')+', 'gi');

function decodeComponents(components, split) {
	try {
		// Try to decode the entire string first
		return [decodeURIComponent(components.join(''))];
	} catch {
		// Do nothing
	}

	if (components.length === 1) {
		return components;
	}

	split = split || 1;

	// Split the array in 2 parts
	const left = components.slice(0, split);
	const right = components.slice(split);

	return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
}

function decode$1(input) {
	try {
		return decodeURIComponent(input);
	} catch {
		let tokens = input.match(singleMatcher) || [];

		for (let i = 1; i < tokens.length; i++) {
			input = decodeComponents(tokens, i).join('');

			tokens = input.match(singleMatcher) || [];
		}

		return input;
	}
}

function customDecodeURIComponent(input) {
	// Keep track of all the replacements and prefill the map with the `BOM`
	const replaceMap = {
		'%FE%FF': '\uFFFD\uFFFD',
		'%FF%FE': '\uFFFD\uFFFD',
	};

	let match = multiMatcher.exec(input);
	while (match) {
		try {
			// Decode as big chunks as possible
			replaceMap[match[0]] = decodeURIComponent(match[0]);
		} catch {
			const result = decode$1(match[0]);

			if (result !== match[0]) {
				replaceMap[match[0]] = result;
			}
		}

		match = multiMatcher.exec(input);
	}

	// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
	replaceMap['%C2'] = '\uFFFD';

	const entries = Object.keys(replaceMap);

	for (const key of entries) {
		// Replace all decoded components
		input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
	}

	return input;
}

function decodeUriComponent(encodedURI) {
	if (typeof encodedURI !== 'string') {
		throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
	}

	try {
		// Try the built in decoder first
		return decodeURIComponent(encodedURI);
	} catch {
		// Fallback to a more advanced decoder
		return customDecodeURIComponent(encodedURI);
	}
}

function splitOnFirst(string, separator) {
	if (!(typeof string === 'string' && typeof separator === 'string')) {
		throw new TypeError('Expected the arguments to be of type `string`');
	}

	if (string === '' || separator === '') {
		return [];
	}

	const separatorIndex = string.indexOf(separator);

	if (separatorIndex === -1) {
		return [];
	}

	return [
		string.slice(0, separatorIndex),
		string.slice(separatorIndex + separator.length)
	];
}

function includeKeys(object, predicate) {
	const result = {};

	if (Array.isArray(predicate)) {
		for (const key of predicate) {
			const descriptor = Object.getOwnPropertyDescriptor(object, key);
			if (descriptor?.enumerable) {
				Object.defineProperty(result, key, descriptor);
			}
		}
	} else {
		// `Reflect.ownKeys()` is required to retrieve symbol properties
		for (const key of Reflect.ownKeys(object)) {
			const descriptor = Object.getOwnPropertyDescriptor(object, key);
			if (descriptor.enumerable) {
				const value = object[key];
				if (predicate(key, value, object)) {
					Object.defineProperty(result, key, descriptor);
				}
			}
		}
	}

	return result;
}

const isNullOrUndefined = value => value === null || value === undefined;

// eslint-disable-next-line unicorn/prefer-code-point
const strictUriEncode = string => encodeURIComponent(string).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

const encodeFragmentIdentifier = Symbol('encodeFragmentIdentifier');

function encoderForArrayFormat(options) {
	switch (options.arrayFormat) {
		case 'index': {
			return key => (result, value) => {
				const index = result.length;

				if (
					value === undefined
					|| (options.skipNull && value === null)
					|| (options.skipEmptyString && value === '')
				) {
					return result;
				}

				if (value === null) {
					return [
						...result, [encode$1(key, options), '[', index, ']'].join(''),
					];
				}

				return [
					...result,
					[encode$1(key, options), '[', encode$1(index, options), ']=', encode$1(value, options)].join(''),
				];
			};
		}

		case 'bracket': {
			return key => (result, value) => {
				if (
					value === undefined
					|| (options.skipNull && value === null)
					|| (options.skipEmptyString && value === '')
				) {
					return result;
				}

				if (value === null) {
					return [
						...result,
						[encode$1(key, options), '[]'].join(''),
					];
				}

				return [
					...result,
					[encode$1(key, options), '[]=', encode$1(value, options)].join(''),
				];
			};
		}

		case 'colon-list-separator': {
			return key => (result, value) => {
				if (
					value === undefined
					|| (options.skipNull && value === null)
					|| (options.skipEmptyString && value === '')
				) {
					return result;
				}

				if (value === null) {
					return [
						...result,
						[encode$1(key, options), ':list='].join(''),
					];
				}

				return [
					...result,
					[encode$1(key, options), ':list=', encode$1(value, options)].join(''),
				];
			};
		}

		case 'comma':
		case 'separator':
		case 'bracket-separator': {
			const keyValueSep = options.arrayFormat === 'bracket-separator'
				? '[]='
				: '=';

			return key => (result, value) => {
				if (
					value === undefined
					|| (options.skipNull && value === null)
					|| (options.skipEmptyString && value === '')
				) {
					return result;
				}

				// Translate null to an empty string so that it doesn't serialize as 'null'
				value = value === null ? '' : value;

				if (result.length === 0) {
					return [[encode$1(key, options), keyValueSep, encode$1(value, options)].join('')];
				}

				return [[result, encode$1(value, options)].join(options.arrayFormatSeparator)];
			};
		}

		default: {
			return key => (result, value) => {
				if (
					value === undefined
					|| (options.skipNull && value === null)
					|| (options.skipEmptyString && value === '')
				) {
					return result;
				}

				if (value === null) {
					return [
						...result,
						encode$1(key, options),
					];
				}

				return [
					...result,
					[encode$1(key, options), '=', encode$1(value, options)].join(''),
				];
			};
		}
	}
}

function parserForArrayFormat(options) {
	let result;

	switch (options.arrayFormat) {
		case 'index': {
			return (key, value, accumulator) => {
				result = /\[(\d*)]$/.exec(key);

				key = key.replace(/\[\d*]$/, '');

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = {};
				}

				accumulator[key][result[1]] = value;
			};
		}

		case 'bracket': {
			return (key, value, accumulator) => {
				result = /(\[])$/.exec(key);
				key = key.replace(/\[]$/, '');

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = [value];
					return;
				}

				accumulator[key] = [...accumulator[key], value];
			};
		}

		case 'colon-list-separator': {
			return (key, value, accumulator) => {
				result = /(:list)$/.exec(key);
				key = key.replace(/:list$/, '');

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = [value];
					return;
				}

				accumulator[key] = [...accumulator[key], value];
			};
		}

		case 'comma':
		case 'separator': {
			return (key, value, accumulator) => {
				const isArray = typeof value === 'string' && value.includes(options.arrayFormatSeparator);
				const isEncodedArray = (typeof value === 'string' && !isArray && decode(value, options).includes(options.arrayFormatSeparator));
				value = isEncodedArray ? decode(value, options) : value;
				const newValue = isArray || isEncodedArray ? value.split(options.arrayFormatSeparator).map(item => decode(item, options)) : (value === null ? value : decode(value, options));
				accumulator[key] = newValue;
			};
		}

		case 'bracket-separator': {
			return (key, value, accumulator) => {
				const isArray = /(\[])$/.test(key);
				key = key.replace(/\[]$/, '');

				if (!isArray) {
					accumulator[key] = value ? decode(value, options) : value;
					return;
				}

				const arrayValue = value === null
					? []
					: value.split(options.arrayFormatSeparator).map(item => decode(item, options));

				if (accumulator[key] === undefined) {
					accumulator[key] = arrayValue;
					return;
				}

				accumulator[key] = [...accumulator[key], ...arrayValue];
			};
		}

		default: {
			return (key, value, accumulator) => {
				if (accumulator[key] === undefined) {
					accumulator[key] = value;
					return;
				}

				accumulator[key] = [...[accumulator[key]].flat(), value];
			};
		}
	}
}

function validateArrayFormatSeparator(value) {
	if (typeof value !== 'string' || value.length !== 1) {
		throw new TypeError('arrayFormatSeparator must be single character string');
	}
}

function encode$1(value, options) {
	if (options.encode) {
		return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
	}

	return value;
}

function decode(value, options) {
	if (options.decode) {
		return decodeUriComponent(value);
	}

	return value;
}

function keysSorter(input) {
	if (Array.isArray(input)) {
		return input.sort();
	}

	if (typeof input === 'object') {
		return keysSorter(Object.keys(input))
			.sort((a, b) => Number(a) - Number(b))
			.map(key => input[key]);
	}

	return input;
}

function removeHash(input) {
	const hashStart = input.indexOf('#');
	if (hashStart !== -1) {
		input = input.slice(0, hashStart);
	}

	return input;
}

function getHash(url) {
	let hash = '';
	const hashStart = url.indexOf('#');
	if (hashStart !== -1) {
		hash = url.slice(hashStart);
	}

	return hash;
}

function parseValue(value, options) {
	if (options.parseNumbers && !Number.isNaN(Number(value)) && (typeof value === 'string' && value.trim() !== '')) {
		value = Number(value);
	} else if (options.parseBooleans && value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
		value = value.toLowerCase() === 'true';
	}

	return value;
}

function extract(input) {
	input = removeHash(input);
	const queryStart = input.indexOf('?');
	if (queryStart === -1) {
		return '';
	}

	return input.slice(queryStart + 1);
}

function parse(query, options) {
	options = {
		decode: true,
		sort: true,
		arrayFormat: 'none',
		arrayFormatSeparator: ',',
		parseNumbers: false,
		parseBooleans: false,
		...options,
	};

	validateArrayFormatSeparator(options.arrayFormatSeparator);

	const formatter = parserForArrayFormat(options);

	// Create an object with no prototype
	const returnValue = Object.create(null);

	if (typeof query !== 'string') {
		return returnValue;
	}

	query = query.trim().replace(/^[?#&]/, '');

	if (!query) {
		return returnValue;
	}

	for (const parameter of query.split('&')) {
		if (parameter === '') {
			continue;
		}

		const parameter_ = options.decode ? parameter.replace(/\+/g, ' ') : parameter;

		let [key, value] = splitOnFirst(parameter_, '=');

		if (key === undefined) {
			key = parameter_;
		}

		// Missing `=` should be `null`:
		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
		value = value === undefined ? null : (['comma', 'separator', 'bracket-separator'].includes(options.arrayFormat) ? value : decode(value, options));
		formatter(decode(key, options), value, returnValue);
	}

	for (const [key, value] of Object.entries(returnValue)) {
		if (typeof value === 'object' && value !== null) {
			for (const [key2, value2] of Object.entries(value)) {
				value[key2] = parseValue(value2, options);
			}
		} else {
			returnValue[key] = parseValue(value, options);
		}
	}

	if (options.sort === false) {
		return returnValue;
	}

	// TODO: Remove the use of `reduce`.
	// eslint-disable-next-line unicorn/no-array-reduce
	return (options.sort === true ? Object.keys(returnValue).sort() : Object.keys(returnValue).sort(options.sort)).reduce((result, key) => {
		const value = returnValue[key];
		if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
			// Sort object keys, not values
			result[key] = keysSorter(value);
		} else {
			result[key] = value;
		}

		return result;
	}, Object.create(null));
}

function stringify(object, options) {
	if (!object) {
		return '';
	}

	options = {encode: true,
		strict: true,
		arrayFormat: 'none',
		arrayFormatSeparator: ',', ...options};

	validateArrayFormatSeparator(options.arrayFormatSeparator);

	const shouldFilter = key => (
		(options.skipNull && isNullOrUndefined(object[key]))
		|| (options.skipEmptyString && object[key] === '')
	);

	const formatter = encoderForArrayFormat(options);

	const objectCopy = {};

	for (const [key, value] of Object.entries(object)) {
		if (!shouldFilter(key)) {
			objectCopy[key] = value;
		}
	}

	const keys = Object.keys(objectCopy);

	if (options.sort !== false) {
		keys.sort(options.sort);
	}

	return keys.map(key => {
		const value = object[key];

		if (value === undefined) {
			return '';
		}

		if (value === null) {
			return encode$1(key, options);
		}

		if (Array.isArray(value)) {
			if (value.length === 0 && options.arrayFormat === 'bracket-separator') {
				return encode$1(key, options) + '[]';
			}

			return value
				.reduce(formatter(key), [])
				.join('&');
		}

		return encode$1(key, options) + '=' + encode$1(value, options);
	}).filter(x => x.length > 0).join('&');
}

function parseUrl(url, options) {
	options = {
		decode: true,
		...options,
	};

	let [url_, hash] = splitOnFirst(url, '#');

	if (url_ === undefined) {
		url_ = url;
	}

	return {
		url: url_?.split('?')?.[0] ?? '',
		query: parse(extract(url), options),
		...(options && options.parseFragmentIdentifier && hash ? {fragmentIdentifier: decode(hash, options)} : {}),
	};
}

function stringifyUrl(object, options) {
	options = {
		encode: true,
		strict: true,
		[encodeFragmentIdentifier]: true,
		...options,
	};

	const url = removeHash(object.url).split('?')[0] || '';
	const queryFromUrl = extract(object.url);

	const query = {
		...parse(queryFromUrl, {sort: false}),
		...object.query,
	};

	let queryString = stringify(query, options);
	if (queryString) {
		queryString = `?${queryString}`;
	}

	let hash = getHash(object.url);
	if (object.fragmentIdentifier) {
		const urlObjectForFragmentEncode = new URL(url);
		urlObjectForFragmentEncode.hash = object.fragmentIdentifier;
		hash = options[encodeFragmentIdentifier] ? urlObjectForFragmentEncode.hash : `#${object.fragmentIdentifier}`;
	}

	return `${url}${queryString}${hash}`;
}

function pick(input, filter, options) {
	options = {
		parseFragmentIdentifier: true,
		[encodeFragmentIdentifier]: false,
		...options,
	};

	const {url, query, fragmentIdentifier} = parseUrl(input, options);

	return stringifyUrl({
		url,
		query: includeKeys(query, filter),
		fragmentIdentifier,
	}, options);
}

function exclude(input, filter, options) {
	const exclusionFilter = Array.isArray(filter) ? key => !filter.includes(key) : (key, value) => !filter(key, value);

	return pick(input, exclusionFilter, options);
}

var queryString = {
	__proto__: null,
	extract: extract,
	parse: parse,
	stringify: stringify,
	parseUrl: parseUrl,
	stringifyUrl: stringifyUrl,
	pick: pick,
	exclude: exclude
};

const collectionData = ['类目商品列表页', 'page_category_product_list'];
const productData = ['商品详情页', 'page_product_detail']; // routeRule: [page_name, page_id]

const pathData = {
  '/': ['首页', 'page_home'],
  '/collections/:type': collectionData,
  '/category/:type': collectionData,
  '/shop/:type': collectionData,
  '/product/editorial/:type': collectionData,
  '/search': ['搜索商品列表页', 'page_search_product_list'],
  '/flashsale': ['闪购商品列表页', 'page_flash_product_list'],
  '/activity/:activityType/:productType/:activityId': ['活动商品列表页', 'page_activity_product_list'],
  '/activityTopic/:id': ['活动专题页', 'page_activity_topic'],
  '/activityTopicApp/:id': ['活动专题页', 'page_activity_topic_app'],
  '/products/:name': productData,
  '/products': productData,
  '/collections/:collectionName/products/:name': productData,
  '/cart': ['购物车', 'page_cart'],
  '/navigation': ['类目导航页', 'page_category'],
  '/navigation/:id': ['服务条款集合页', 'page_provision_list'],
  '/checkout/payment-method/:mid': ['结算页', 'page_checkout'],
  '/checkout/success': ['支付成功页', 'page_pay_succeed'],
  '/checkout/address/:mid': ['选择地址页', 'page_select_address'],
  '/checkout/shipping-method/:mid': ['物流选择页', 'page_shipping_method'],
  '/checkout/payment-card/:mid': ['信用卡直连支付页', 'page_checkout_payment_creditcard'],
  '/payment/:order_id': ['邮箱支付页', 'page_payment_email'],
  '/payment': ['订单支付页', 'page_payment_order'],
  '/account/login': ['登录注册页', 'page_login_register'],
  '/account/recover': ['找回密码页', 'page_user_recover'],
  '/account/resetpassword': ['重置密码页', 'page_user_resetpassword'],
  '/account/review': ['评论列表页', 'page_account_review'],
  '/account/register': ['注册页', 'page_user_register'],
  '/account': ['个人中心页', 'page_user_centre'],
  '/account/setting': ['设置页', 'page_user_setting'],
  '/account/settingcurrency': ['币种选择页', 'page_choose_currency'],
  '/account/settinglanguage': ['语言选择页', 'page_choose_language'],
  '/account/changepassword': ['密码修改页', 'page_setting_password'],
  '/account/address': ['个人中心地址簿', 'page_account_address'],
  '/account/collect': ['收藏页', 'page_collect'],
  '/account/settingnav': ['个人中心导航页', 'page_account_settingnav'],
  '/contact-us': ['联系我们', 'page_contact_us'],
  '/checkout/address-book': ['地址簿', 'page_user_address_book'],
  '/account/orderlist': ['订单列表页', 'page_order_list'],
  '/account/order/:orderId': ['订单详情页', 'page_order_detail'],
  '/account/coupon': ['优惠券中心页', 'page_user_coupon'],
  '/account/wallet': ['钱包账户页面', 'page_wallet'],
  '/account/wallet/detail': ['钱包余额明细', 'page_wallet_detail'],
  '/wallet-faq': ['钱包faq页面', 'page_wallet_faq'],
  '/wallet-service': ['钱包政策页面', 'page_wallet_items'],
  '/account/review/:orderId/:subOrderId': ['评论页', 'page_review'],
  '/returndetail/:returnOrderId': ['退货退款详情页', 'page_return_detail'],
  '/return/:orderId/:subOrderId': ['退货退款申请页', 'page_return_application'],
  '/order-query': ['订单查询页', 'page_order_query'],
  '/products/:productId/review': ['商品评论页', 'page_review_list'],
  '/blog': ['blog列表页', 'page_blog'],
  '/blog-detail/:name': ['blog详情页', 'page_blog_detail'],
  '/customer-reviews': ['顾客评论列表', 'page_reviews'],
  '/gcr': ['GCR调查问卷页', 'page_gcr'],
  '/information/:title': ['服务条款页', 'page_information_title'],
  '/invitation/expired': ['分享获礼过期页', 'page_invitation_expired'],
  '/invitation/overview': ['分享获礼概述页', 'page_invitation_overview'],
  '/invitation/regist': ['分享获礼注册页', 'page_invitation_regist'],
  '/new-product-test/:id': ['新品测试页', 'page_newproduct_test'],
  '/payment-wpeur': ['支付loading页', 'page_blog_detail'],
  '/seems-you-like': ['邮件推荐商品落地页', 'page_email_recommend'],
  '/c/:name': ['词库页', 'page_word_bank'],
  '/faq': ['faq页面', 'page_faq_list']
};

var FunctionPrototype$4 = Function.prototype;
var bind$3 = FunctionPrototype$4.bind;
var call$4 = FunctionPrototype$4.call;
var callBind$1 = bind$3 && bind$3.bind(call$4);

var functionUncurryThis$1 = bind$3 ? function (fn) {
  return fn && callBind$1(call$4, fn);
} : function (fn) {
  return fn && function () {
    return call$4.apply(fn, arguments);
  };
};

var ceil$1 = Math.ceil;
var floor$5 = Math.floor;

// `ToIntegerOrInfinity` abstract operation
// https://tc39.es/ecma262/#sec-tointegerorinfinity
var toIntegerOrInfinity$1 = function (argument) {
  var number = +argument;
  // eslint-disable-next-line no-self-compare -- safe
  return number !== number || number === 0 ? 0 : (number > 0 ? floor$5 : ceil$1)(number);
};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn) {
  var module = { exports: {} };
	return fn(module, module.exports), module.exports;
}

var check$1 = function (it) {
  return it && it.Math == Math && it;
};

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global$2 =
  // eslint-disable-next-line es/no-global-this -- safe
  check$1(typeof globalThis == 'object' && globalThis) ||
  check$1(typeof window == 'object' && window) ||
  // eslint-disable-next-line no-restricted-globals -- safe
  check$1(typeof self == 'object' && self) ||
  check$1(typeof commonjsGlobal == 'object' && commonjsGlobal) ||
  // eslint-disable-next-line no-new-func -- fallback
  (function () { return this; })() || Function('return this')();

var isPure = true;

// eslint-disable-next-line es/no-object-defineproperty -- safe
var defineProperty$4 = Object.defineProperty;

var setGlobal$1 = function (key, value) {
  try {
    defineProperty$4(global$2, key, { value: value, configurable: true, writable: true });
  } catch (error) {
    global$2[key] = value;
  } return value;
};

var SHARED$1 = '__core-js_shared__';
var store$3 = global$2[SHARED$1] || setGlobal$1(SHARED$1, {});

var sharedStore$1 = store$3;

var shared$1 = createCommonjsModule(function (module) {
(module.exports = function (key, value) {
  return sharedStore$1[key] || (sharedStore$1[key] = value !== undefined ? value : {});
})('versions', []).push({
  version: '3.19.3',
  mode: 'pure' ,
  copyright: '© 2021 Denis Pushkarev (zloirock.ru)'
});
});

var TypeError$l = global$2.TypeError;

// `RequireObjectCoercible` abstract operation
// https://tc39.es/ecma262/#sec-requireobjectcoercible
var requireObjectCoercible$1 = function (it) {
  if (it == undefined) throw TypeError$l("Can't call method on " + it);
  return it;
};

var Object$9 = global$2.Object;

// `ToObject` abstract operation
// https://tc39.es/ecma262/#sec-toobject
var toObject$1 = function (argument) {
  return Object$9(requireObjectCoercible$1(argument));
};

var hasOwnProperty$1 = functionUncurryThis$1({}.hasOwnProperty);

// `HasOwnProperty` abstract operation
// https://tc39.es/ecma262/#sec-hasownproperty
var hasOwnProperty_1$1 = Object.hasOwn || function hasOwn(it, key) {
  return hasOwnProperty$1(toObject$1(it), key);
};

var id$1 = 0;
var postfix$1 = Math.random();
var toString$4 = functionUncurryThis$1(1.0.toString);

var uid$1 = function (key) {
  return 'Symbol(' + (key === undefined ? '' : key) + ')_' + toString$4(++id$1 + postfix$1, 36);
};

var path$1 = {};

// `IsCallable` abstract operation
// https://tc39.es/ecma262/#sec-iscallable
var isCallable$1 = function (argument) {
  return typeof argument == 'function';
};

var aFunction$1 = function (variable) {
  return isCallable$1(variable) ? variable : undefined;
};

var getBuiltIn$1 = function (namespace, method) {
  return arguments.length < 2 ? aFunction$1(path$1[namespace]) || aFunction$1(global$2[namespace])
    : path$1[namespace] && path$1[namespace][method] || global$2[namespace] && global$2[namespace][method];
};

var engineUserAgent$1 = getBuiltIn$1('navigator', 'userAgent') || '';

var process$1 = global$2.process;
var Deno$1 = global$2.Deno;
var versions$1 = process$1 && process$1.versions || Deno$1 && Deno$1.version;
var v8$1 = versions$1 && versions$1.v8;
var match$1, version$1;

if (v8$1) {
  match$1 = v8$1.split('.');
  // in old Chrome, versions of V8 isn't V8 = Chrome / 10
  // but their correct versions are not interesting for us
  version$1 = match$1[0] > 0 && match$1[0] < 4 ? 1 : +(match$1[0] + match$1[1]);
}

// BrowserFS NodeJS `process` polyfill incorrectly set `.v8` to `0.0`
// so check `userAgent` even if `.v8` exists, but 0
if (!version$1 && engineUserAgent$1) {
  match$1 = engineUserAgent$1.match(/Edge\/(\d+)/);
  if (!match$1 || match$1[1] >= 74) {
    match$1 = engineUserAgent$1.match(/Chrome\/(\d+)/);
    if (match$1) version$1 = +match$1[1];
  }
}

var engineV8Version$1 = version$1;

var fails$1 = function (exec) {
  try {
    return !!exec();
  } catch (error) {
    return true;
  }
};

/* eslint-disable es/no-symbol -- required for testing */

// eslint-disable-next-line es/no-object-getownpropertysymbols -- required for testing
var nativeSymbol$1 = !!Object.getOwnPropertySymbols && !fails$1(function () {
  var symbol = Symbol();
  // Chrome 38 Symbol has incorrect toString conversion
  // `get-own-property-symbols` polyfill symbols converted to object are not Symbol instances
  return !String(symbol) || !(Object(symbol) instanceof Symbol) ||
    // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
    !Symbol.sham && engineV8Version$1 && engineV8Version$1 < 41;
});

/* eslint-disable es/no-symbol -- required for testing */

var useSymbolAsUid$1 = nativeSymbol$1
  && !Symbol.sham
  && typeof Symbol.iterator == 'symbol';

var WellKnownSymbolsStore$1 = shared$1('wks');
var Symbol$2 = global$2.Symbol;
var symbolFor$1 = Symbol$2 && Symbol$2['for'];
var createWellKnownSymbol$1 = useSymbolAsUid$1 ? Symbol$2 : Symbol$2 && Symbol$2.withoutSetter || uid$1;

var wellKnownSymbol$1 = function (name) {
  if (!hasOwnProperty_1$1(WellKnownSymbolsStore$1, name) || !(nativeSymbol$1 || typeof WellKnownSymbolsStore$1[name] == 'string')) {
    var description = 'Symbol.' + name;
    if (nativeSymbol$1 && hasOwnProperty_1$1(Symbol$2, name)) {
      WellKnownSymbolsStore$1[name] = Symbol$2[name];
    } else if (useSymbolAsUid$1 && symbolFor$1) {
      WellKnownSymbolsStore$1[name] = symbolFor$1(description);
    } else {
      WellKnownSymbolsStore$1[name] = createWellKnownSymbol$1(description);
    }
  } return WellKnownSymbolsStore$1[name];
};

var TO_STRING_TAG$4 = wellKnownSymbol$1('toStringTag');
var test = {};

test[TO_STRING_TAG$4] = 'z';

var toStringTagSupport = String(test) === '[object z]';

var toString$3 = functionUncurryThis$1({}.toString);
var stringSlice$6 = functionUncurryThis$1(''.slice);

var classofRaw$1 = function (it) {
  return stringSlice$6(toString$3(it), 8, -1);
};

var TO_STRING_TAG$3 = wellKnownSymbol$1('toStringTag');
var Object$8 = global$2.Object;

// ES3 wrong here
var CORRECT_ARGUMENTS = classofRaw$1(function () { return arguments; }()) == 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function (it, key) {
  try {
    return it[key];
  } catch (error) { /* empty */ }
};

// getting tag from ES6+ `Object.prototype.toString`
var classof = toStringTagSupport ? classofRaw$1 : function (it) {
  var O, tag, result;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (tag = tryGet(O = Object$8(it), TO_STRING_TAG$3)) == 'string' ? tag
    // builtinTag case
    : CORRECT_ARGUMENTS ? classofRaw$1(O)
    // ES3 arguments fallback
    : (result = classofRaw$1(O)) == 'Object' && isCallable$1(O.callee) ? 'Arguments' : result;
};

var String$7 = global$2.String;

var toString$2 = function (argument) {
  if (classof(argument) === 'Symbol') throw TypeError('Cannot convert a Symbol value to a string');
  return String$7(argument);
};

var charAt$4 = functionUncurryThis$1(''.charAt);
var charCodeAt$1 = functionUncurryThis$1(''.charCodeAt);
var stringSlice$5 = functionUncurryThis$1(''.slice);

var createMethod$2 = function (CONVERT_TO_STRING) {
  return function ($this, pos) {
    var S = toString$2(requireObjectCoercible$1($this));
    var position = toIntegerOrInfinity$1(pos);
    var size = S.length;
    var first, second;
    if (position < 0 || position >= size) return CONVERT_TO_STRING ? '' : undefined;
    first = charCodeAt$1(S, position);
    return first < 0xD800 || first > 0xDBFF || position + 1 === size
      || (second = charCodeAt$1(S, position + 1)) < 0xDC00 || second > 0xDFFF
        ? CONVERT_TO_STRING
          ? charAt$4(S, position)
          : first
        : CONVERT_TO_STRING
          ? stringSlice$5(S, position, position + 2)
          : (first - 0xD800 << 10) + (second - 0xDC00) + 0x10000;
  };
};

var stringMultibyte = {
  // `String.prototype.codePointAt` method
  // https://tc39.es/ecma262/#sec-string.prototype.codepointat
  codeAt: createMethod$2(false),
  // `String.prototype.at` method
  // https://github.com/mathiasbynens/String.prototype.at
  charAt: createMethod$2(true)
};

var functionToString$1 = functionUncurryThis$1(Function.toString);

// this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
if (!isCallable$1(sharedStore$1.inspectSource)) {
  sharedStore$1.inspectSource = function (it) {
    return functionToString$1(it);
  };
}

var inspectSource$1 = sharedStore$1.inspectSource;

var WeakMap$4 = global$2.WeakMap;

var nativeWeakMap$1 = isCallable$1(WeakMap$4) && /native code/.test(inspectSource$1(WeakMap$4));

var isObject$1 = function (it) {
  return typeof it == 'object' ? it !== null : isCallable$1(it);
};

// Detect IE8's incomplete defineProperty implementation
var descriptors$1 = !fails$1(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- required for testing
  return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
});

var document$2 = global$2.document;
// typeof document.createElement is 'object' in old IE
var EXISTS$3 = isObject$1(document$2) && isObject$1(document$2.createElement);

var documentCreateElement$1 = function (it) {
  return EXISTS$3 ? document$2.createElement(it) : {};
};

// Thank's IE8 for his funny defineProperty
var ie8DomDefine$1 = !descriptors$1 && !fails$1(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- requied for testing
  return Object.defineProperty(documentCreateElement$1('div'), 'a', {
    get: function () { return 7; }
  }).a != 7;
});

var String$6 = global$2.String;
var TypeError$k = global$2.TypeError;

// `Assert: Type(argument) is Object`
var anObject$1 = function (argument) {
  if (isObject$1(argument)) return argument;
  throw TypeError$k(String$6(argument) + ' is not an object');
};

var call$3 = Function.prototype.call;

var functionCall$1 = call$3.bind ? call$3.bind(call$3) : function () {
  return call$3.apply(call$3, arguments);
};

var objectIsPrototypeOf$1 = functionUncurryThis$1({}.isPrototypeOf);

var Object$7 = global$2.Object;

var isSymbol$1 = useSymbolAsUid$1 ? function (it) {
  return typeof it == 'symbol';
} : function (it) {
  var $Symbol = getBuiltIn$1('Symbol');
  return isCallable$1($Symbol) && objectIsPrototypeOf$1($Symbol.prototype, Object$7(it));
};

var String$5 = global$2.String;

var tryToString$1 = function (argument) {
  try {
    return String$5(argument);
  } catch (error) {
    return 'Object';
  }
};

var TypeError$j = global$2.TypeError;

// `Assert: IsCallable(argument) is true`
var aCallable$1 = function (argument) {
  if (isCallable$1(argument)) return argument;
  throw TypeError$j(tryToString$1(argument) + ' is not a function');
};

// `GetMethod` abstract operation
// https://tc39.es/ecma262/#sec-getmethod
var getMethod$1 = function (V, P) {
  var func = V[P];
  return func == null ? undefined : aCallable$1(func);
};

var TypeError$i = global$2.TypeError;

// `OrdinaryToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-ordinarytoprimitive
var ordinaryToPrimitive$1 = function (input, pref) {
  var fn, val;
  if (pref === 'string' && isCallable$1(fn = input.toString) && !isObject$1(val = functionCall$1(fn, input))) return val;
  if (isCallable$1(fn = input.valueOf) && !isObject$1(val = functionCall$1(fn, input))) return val;
  if (pref !== 'string' && isCallable$1(fn = input.toString) && !isObject$1(val = functionCall$1(fn, input))) return val;
  throw TypeError$i("Can't convert object to primitive value");
};

var TypeError$h = global$2.TypeError;
var TO_PRIMITIVE$1 = wellKnownSymbol$1('toPrimitive');

// `ToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-toprimitive
var toPrimitive$1 = function (input, pref) {
  if (!isObject$1(input) || isSymbol$1(input)) return input;
  var exoticToPrim = getMethod$1(input, TO_PRIMITIVE$1);
  var result;
  if (exoticToPrim) {
    if (pref === undefined) pref = 'default';
    result = functionCall$1(exoticToPrim, input, pref);
    if (!isObject$1(result) || isSymbol$1(result)) return result;
    throw TypeError$h("Can't convert object to primitive value");
  }
  if (pref === undefined) pref = 'number';
  return ordinaryToPrimitive$1(input, pref);
};

// `ToPropertyKey` abstract operation
// https://tc39.es/ecma262/#sec-topropertykey
var toPropertyKey$1 = function (argument) {
  var key = toPrimitive$1(argument, 'string');
  return isSymbol$1(key) ? key : key + '';
};

var TypeError$g = global$2.TypeError;
// eslint-disable-next-line es/no-object-defineproperty -- safe
var $defineProperty$1 = Object.defineProperty;

// `Object.defineProperty` method
// https://tc39.es/ecma262/#sec-object.defineproperty
var f$8 = descriptors$1 ? $defineProperty$1 : function defineProperty(O, P, Attributes) {
  anObject$1(O);
  P = toPropertyKey$1(P);
  anObject$1(Attributes);
  if (ie8DomDefine$1) try {
    return $defineProperty$1(O, P, Attributes);
  } catch (error) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError$g('Accessors not supported');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};

var objectDefineProperty$1 = {
	f: f$8
};

var createPropertyDescriptor$1 = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};

var createNonEnumerableProperty$1 = descriptors$1 ? function (object, key, value) {
  return objectDefineProperty$1.f(object, key, createPropertyDescriptor$1(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};

var keys$1 = shared$1('keys');

var sharedKey$1 = function (key) {
  return keys$1[key] || (keys$1[key] = uid$1(key));
};

var hiddenKeys$2 = {};

var OBJECT_ALREADY_INITIALIZED$1 = 'Object already initialized';
var TypeError$f = global$2.TypeError;
var WeakMap$3 = global$2.WeakMap;
var set$1, get$1, has$1;

var enforce$1 = function (it) {
  return has$1(it) ? get$1(it) : set$1(it, {});
};

var getterFor$1 = function (TYPE) {
  return function (it) {
    var state;
    if (!isObject$1(it) || (state = get$1(it)).type !== TYPE) {
      throw TypeError$f('Incompatible receiver, ' + TYPE + ' required');
    } return state;
  };
};

if (nativeWeakMap$1 || sharedStore$1.state) {
  var store$2 = sharedStore$1.state || (sharedStore$1.state = new WeakMap$3());
  var wmget$1 = functionUncurryThis$1(store$2.get);
  var wmhas$1 = functionUncurryThis$1(store$2.has);
  var wmset$1 = functionUncurryThis$1(store$2.set);
  set$1 = function (it, metadata) {
    if (wmhas$1(store$2, it)) throw new TypeError$f(OBJECT_ALREADY_INITIALIZED$1);
    metadata.facade = it;
    wmset$1(store$2, it, metadata);
    return metadata;
  };
  get$1 = function (it) {
    return wmget$1(store$2, it) || {};
  };
  has$1 = function (it) {
    return wmhas$1(store$2, it);
  };
} else {
  var STATE$1 = sharedKey$1('state');
  hiddenKeys$2[STATE$1] = true;
  set$1 = function (it, metadata) {
    if (hasOwnProperty_1$1(it, STATE$1)) throw new TypeError$f(OBJECT_ALREADY_INITIALIZED$1);
    metadata.facade = it;
    createNonEnumerableProperty$1(it, STATE$1, metadata);
    return metadata;
  };
  get$1 = function (it) {
    return hasOwnProperty_1$1(it, STATE$1) ? it[STATE$1] : {};
  };
  has$1 = function (it) {
    return hasOwnProperty_1$1(it, STATE$1);
  };
}

var internalState$1 = {
  set: set$1,
  get: get$1,
  has: has$1,
  enforce: enforce$1,
  getterFor: getterFor$1
};

var FunctionPrototype$3 = Function.prototype;
var apply = FunctionPrototype$3.apply;
var bind$2 = FunctionPrototype$3.bind;
var call$2 = FunctionPrototype$3.call;

// eslint-disable-next-line es/no-reflect -- safe
var functionApply = typeof Reflect == 'object' && Reflect.apply || (bind$2 ? call$2.bind(apply) : function () {
  return call$2.apply(apply, arguments);
});

var $propertyIsEnumerable$1 = {}.propertyIsEnumerable;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getOwnPropertyDescriptor$3 = Object.getOwnPropertyDescriptor;

// Nashorn ~ JDK8 bug
var NASHORN_BUG$1 = getOwnPropertyDescriptor$3 && !$propertyIsEnumerable$1.call({ 1: 2 }, 1);

// `Object.prototype.propertyIsEnumerable` method implementation
// https://tc39.es/ecma262/#sec-object.prototype.propertyisenumerable
var f$7 = NASHORN_BUG$1 ? function propertyIsEnumerable(V) {
  var descriptor = getOwnPropertyDescriptor$3(this, V);
  return !!descriptor && descriptor.enumerable;
} : $propertyIsEnumerable$1;

var objectPropertyIsEnumerable$1 = {
	f: f$7
};

var Object$6 = global$2.Object;
var split$4 = functionUncurryThis$1(''.split);

// fallback for non-array-like ES3 and non-enumerable old V8 strings
var indexedObject$1 = fails$1(function () {
  // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
  // eslint-disable-next-line no-prototype-builtins -- safe
  return !Object$6('z').propertyIsEnumerable(0);
}) ? function (it) {
  return classofRaw$1(it) == 'String' ? split$4(it, '') : Object$6(it);
} : Object$6;

// toObject with fallback for non-array-like ES3 strings



var toIndexedObject$1 = function (it) {
  return indexedObject$1(requireObjectCoercible$1(it));
};

// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var $getOwnPropertyDescriptor$1 = Object.getOwnPropertyDescriptor;

// `Object.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
var f$6 = descriptors$1 ? $getOwnPropertyDescriptor$1 : function getOwnPropertyDescriptor(O, P) {
  O = toIndexedObject$1(O);
  P = toPropertyKey$1(P);
  if (ie8DomDefine$1) try {
    return $getOwnPropertyDescriptor$1(O, P);
  } catch (error) { /* empty */ }
  if (hasOwnProperty_1$1(O, P)) return createPropertyDescriptor$1(!functionCall$1(objectPropertyIsEnumerable$1.f, O, P), O[P]);
};

var objectGetOwnPropertyDescriptor$1 = {
	f: f$6
};

var replacement$1 = /#|\.prototype\./;

var isForced$1 = function (feature, detection) {
  var value = data$1[normalize$1(feature)];
  return value == POLYFILL$1 ? true
    : value == NATIVE$1 ? false
    : isCallable$1(detection) ? fails$1(detection)
    : !!detection;
};

var normalize$1 = isForced$1.normalize = function (string) {
  return String(string).replace(replacement$1, '.').toLowerCase();
};

var data$1 = isForced$1.data = {};
var NATIVE$1 = isForced$1.NATIVE = 'N';
var POLYFILL$1 = isForced$1.POLYFILL = 'P';

var isForced_1$1 = isForced$1;

var bind$1 = functionUncurryThis$1(functionUncurryThis$1.bind);

// optional / simple context binding
var functionBindContext = function (fn, that) {
  aCallable$1(fn);
  return that === undefined ? fn : bind$1 ? bind$1(fn, that) : function (/* ...args */) {
    return fn.apply(that, arguments);
  };
};

var getOwnPropertyDescriptor$2 = objectGetOwnPropertyDescriptor$1.f;






var wrapConstructor = function (NativeConstructor) {
  var Wrapper = function (a, b, c) {
    if (this instanceof Wrapper) {
      switch (arguments.length) {
        case 0: return new NativeConstructor();
        case 1: return new NativeConstructor(a);
        case 2: return new NativeConstructor(a, b);
      } return new NativeConstructor(a, b, c);
    } return functionApply(NativeConstructor, this, arguments);
  };
  Wrapper.prototype = NativeConstructor.prototype;
  return Wrapper;
};

/*
  options.target      - name of the target object
  options.global      - target is the global object
  options.stat        - export as static methods of target
  options.proto       - export as prototype methods of target
  options.real        - real prototype method for the `pure` version
  options.forced      - export even if the native feature is available
  options.bind        - bind methods to the target, required for the `pure` version
  options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
  options.unsafe      - use the simple assignment of property instead of delete + defineProperty
  options.sham        - add a flag to not completely full polyfills
  options.enumerable  - export as enumerable property
  options.noTargetGet - prevent calling a getter on target
  options.name        - the .name of the function if it does not match the key
*/
var _export$1 = function (options, source) {
  var TARGET = options.target;
  var GLOBAL = options.global;
  var STATIC = options.stat;
  var PROTO = options.proto;

  var nativeSource = GLOBAL ? global$2 : STATIC ? global$2[TARGET] : (global$2[TARGET] || {}).prototype;

  var target = GLOBAL ? path$1 : path$1[TARGET] || createNonEnumerableProperty$1(path$1, TARGET, {})[TARGET];
  var targetPrototype = target.prototype;

  var FORCED, USE_NATIVE, VIRTUAL_PROTOTYPE;
  var key, sourceProperty, targetProperty, nativeProperty, resultProperty, descriptor;

  for (key in source) {
    FORCED = isForced_1$1(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
    // contains in native
    USE_NATIVE = !FORCED && nativeSource && hasOwnProperty_1$1(nativeSource, key);

    targetProperty = target[key];

    if (USE_NATIVE) if (options.noTargetGet) {
      descriptor = getOwnPropertyDescriptor$2(nativeSource, key);
      nativeProperty = descriptor && descriptor.value;
    } else nativeProperty = nativeSource[key];

    // export native or implementation
    sourceProperty = (USE_NATIVE && nativeProperty) ? nativeProperty : source[key];

    if (USE_NATIVE && typeof targetProperty == typeof sourceProperty) continue;

    // bind timers to global for call from export context
    if (options.bind && USE_NATIVE) resultProperty = functionBindContext(sourceProperty, global$2);
    // wrap global constructors for prevent changs in this version
    else if (options.wrap && USE_NATIVE) resultProperty = wrapConstructor(sourceProperty);
    // make static versions for prototype methods
    else if (PROTO && isCallable$1(sourceProperty)) resultProperty = functionUncurryThis$1(sourceProperty);
    // default case
    else resultProperty = sourceProperty;

    // add a flag to not completely full polyfills
    if (options.sham || (sourceProperty && sourceProperty.sham) || (targetProperty && targetProperty.sham)) {
      createNonEnumerableProperty$1(resultProperty, 'sham', true);
    }

    createNonEnumerableProperty$1(target, key, resultProperty);

    if (PROTO) {
      VIRTUAL_PROTOTYPE = TARGET + 'Prototype';
      if (!hasOwnProperty_1$1(path$1, VIRTUAL_PROTOTYPE)) {
        createNonEnumerableProperty$1(path$1, VIRTUAL_PROTOTYPE, {});
      }
      // export virtual prototype methods
      createNonEnumerableProperty$1(path$1[VIRTUAL_PROTOTYPE], key, sourceProperty);
      // export real prototype methods
      if (options.real && targetPrototype && !targetPrototype[key]) {
        createNonEnumerableProperty$1(targetPrototype, key, sourceProperty);
      }
    }
  }
};

var FunctionPrototype$2 = Function.prototype;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getDescriptor$1 = descriptors$1 && Object.getOwnPropertyDescriptor;

var EXISTS$2 = hasOwnProperty_1$1(FunctionPrototype$2, 'name');
// additional protection from minified / mangled / dropped function names
var PROPER$1 = EXISTS$2 && (function something() { /* empty */ }).name === 'something';
var CONFIGURABLE$1 = EXISTS$2 && (!descriptors$1 || (descriptors$1 && getDescriptor$1(FunctionPrototype$2, 'name').configurable));

var functionName$1 = {
  EXISTS: EXISTS$2,
  PROPER: PROPER$1,
  CONFIGURABLE: CONFIGURABLE$1
};

var max$3 = Math.max;
var min$3 = Math.min;

// Helper for a popular repeating case of the spec:
// Let integer be ? ToInteger(index).
// If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
var toAbsoluteIndex$1 = function (index, length) {
  var integer = toIntegerOrInfinity$1(index);
  return integer < 0 ? max$3(integer + length, 0) : min$3(integer, length);
};

var min$2 = Math.min;

// `ToLength` abstract operation
// https://tc39.es/ecma262/#sec-tolength
var toLength$1 = function (argument) {
  return argument > 0 ? min$2(toIntegerOrInfinity$1(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
};

// `LengthOfArrayLike` abstract operation
// https://tc39.es/ecma262/#sec-lengthofarraylike
var lengthOfArrayLike$1 = function (obj) {
  return toLength$1(obj.length);
};

// `Array.prototype.{ indexOf, includes }` methods implementation
var createMethod$1 = function (IS_INCLUDES) {
  return function ($this, el, fromIndex) {
    var O = toIndexedObject$1($this);
    var length = lengthOfArrayLike$1(O);
    var index = toAbsoluteIndex$1(fromIndex, length);
    var value;
    // Array#includes uses SameValueZero equality algorithm
    // eslint-disable-next-line no-self-compare -- NaN check
    if (IS_INCLUDES && el != el) while (length > index) {
      value = O[index++];
      // eslint-disable-next-line no-self-compare -- NaN check
      if (value != value) return true;
    // Array#indexOf ignores holes, Array#includes - not
    } else for (;length > index; index++) {
      if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};

var arrayIncludes$1 = {
  // `Array.prototype.includes` method
  // https://tc39.es/ecma262/#sec-array.prototype.includes
  includes: createMethod$1(true),
  // `Array.prototype.indexOf` method
  // https://tc39.es/ecma262/#sec-array.prototype.indexof
  indexOf: createMethod$1(false)
};

var indexOf$2 = arrayIncludes$1.indexOf;


var push$5 = functionUncurryThis$1([].push);

var objectKeysInternal$1 = function (object, names) {
  var O = toIndexedObject$1(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) !hasOwnProperty_1$1(hiddenKeys$2, key) && hasOwnProperty_1$1(O, key) && push$5(result, key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (hasOwnProperty_1$1(O, key = names[i++])) {
    ~indexOf$2(result, key) || push$5(result, key);
  }
  return result;
};

// IE8- don't enum bug keys
var enumBugKeys$1 = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf'
];

// `Object.keys` method
// https://tc39.es/ecma262/#sec-object.keys
// eslint-disable-next-line es/no-object-keys -- safe
var objectKeys$1 = Object.keys || function keys(O) {
  return objectKeysInternal$1(O, enumBugKeys$1);
};

// `Object.defineProperties` method
// https://tc39.es/ecma262/#sec-object.defineproperties
// eslint-disable-next-line es/no-object-defineproperties -- safe
var objectDefineProperties$1 = descriptors$1 ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject$1(O);
  var props = toIndexedObject$1(Properties);
  var keys = objectKeys$1(Properties);
  var length = keys.length;
  var index = 0;
  var key;
  while (length > index) objectDefineProperty$1.f(O, key = keys[index++], props[key]);
  return O;
};

var html$1 = getBuiltIn$1('document', 'documentElement');

/* global ActiveXObject -- old IE, WSH */

var GT$1 = '>';
var LT$1 = '<';
var PROTOTYPE$1 = 'prototype';
var SCRIPT$1 = 'script';
var IE_PROTO$3 = sharedKey$1('IE_PROTO');

var EmptyConstructor$1 = function () { /* empty */ };

var scriptTag$1 = function (content) {
  return LT$1 + SCRIPT$1 + GT$1 + content + LT$1 + '/' + SCRIPT$1 + GT$1;
};

// Create object with fake `null` prototype: use ActiveX Object with cleared prototype
var NullProtoObjectViaActiveX$1 = function (activeXDocument) {
  activeXDocument.write(scriptTag$1(''));
  activeXDocument.close();
  var temp = activeXDocument.parentWindow.Object;
  activeXDocument = null; // avoid memory leak
  return temp;
};

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var NullProtoObjectViaIFrame$1 = function () {
  // Thrash, waste and sodomy: IE GC bug
  var iframe = documentCreateElement$1('iframe');
  var JS = 'java' + SCRIPT$1 + ':';
  var iframeDocument;
  iframe.style.display = 'none';
  html$1.appendChild(iframe);
  // https://github.com/zloirock/core-js/issues/475
  iframe.src = String(JS);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(scriptTag$1('document.F=Object'));
  iframeDocument.close();
  return iframeDocument.F;
};

// Check for document.domain and active x support
// No need to use active x approach when document.domain is not set
// see https://github.com/es-shims/es5-shim/issues/150
// variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
// avoid IE GC bug
var activeXDocument$1;
var NullProtoObject$1 = function () {
  try {
    activeXDocument$1 = new ActiveXObject('htmlfile');
  } catch (error) { /* ignore */ }
  NullProtoObject$1 = typeof document != 'undefined'
    ? document.domain && activeXDocument$1
      ? NullProtoObjectViaActiveX$1(activeXDocument$1) // old IE
      : NullProtoObjectViaIFrame$1()
    : NullProtoObjectViaActiveX$1(activeXDocument$1); // WSH
  var length = enumBugKeys$1.length;
  while (length--) delete NullProtoObject$1[PROTOTYPE$1][enumBugKeys$1[length]];
  return NullProtoObject$1();
};

hiddenKeys$2[IE_PROTO$3] = true;

// `Object.create` method
// https://tc39.es/ecma262/#sec-object.create
var objectCreate$1 = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    EmptyConstructor$1[PROTOTYPE$1] = anObject$1(O);
    result = new EmptyConstructor$1();
    EmptyConstructor$1[PROTOTYPE$1] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO$3] = O;
  } else result = NullProtoObject$1();
  return Properties === undefined ? result : objectDefineProperties$1(result, Properties);
};

var correctPrototypeGetter$1 = !fails$1(function () {
  function F() { /* empty */ }
  F.prototype.constructor = null;
  // eslint-disable-next-line es/no-object-getprototypeof -- required for testing
  return Object.getPrototypeOf(new F()) !== F.prototype;
});

var IE_PROTO$2 = sharedKey$1('IE_PROTO');
var Object$5 = global$2.Object;
var ObjectPrototype$1 = Object$5.prototype;

// `Object.getPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.getprototypeof
var objectGetPrototypeOf$1 = correctPrototypeGetter$1 ? Object$5.getPrototypeOf : function (O) {
  var object = toObject$1(O);
  if (hasOwnProperty_1$1(object, IE_PROTO$2)) return object[IE_PROTO$2];
  var constructor = object.constructor;
  if (isCallable$1(constructor) && object instanceof constructor) {
    return constructor.prototype;
  } return object instanceof Object$5 ? ObjectPrototype$1 : null;
};

var redefine$1 = function (target, key, value, options) {
  if (options && options.enumerable) target[key] = value;
  else createNonEnumerableProperty$1(target, key, value);
};

var ITERATOR$8 = wellKnownSymbol$1('iterator');
var BUGGY_SAFARI_ITERATORS$3 = false;

// `%IteratorPrototype%` object
// https://tc39.es/ecma262/#sec-%iteratorprototype%-object
var IteratorPrototype$4, PrototypeOfArrayIteratorPrototype$1, arrayIterator$1;

/* eslint-disable es/no-array-prototype-keys -- safe */
if ([].keys) {
  arrayIterator$1 = [].keys();
  // Safari 8 has buggy iterators w/o `next`
  if (!('next' in arrayIterator$1)) BUGGY_SAFARI_ITERATORS$3 = true;
  else {
    PrototypeOfArrayIteratorPrototype$1 = objectGetPrototypeOf$1(objectGetPrototypeOf$1(arrayIterator$1));
    if (PrototypeOfArrayIteratorPrototype$1 !== Object.prototype) IteratorPrototype$4 = PrototypeOfArrayIteratorPrototype$1;
  }
}

var NEW_ITERATOR_PROTOTYPE$1 = IteratorPrototype$4 == undefined || fails$1(function () {
  var test = {};
  // FF44- legacy iterators case
  return IteratorPrototype$4[ITERATOR$8].call(test) !== test;
});

if (NEW_ITERATOR_PROTOTYPE$1) IteratorPrototype$4 = {};
else IteratorPrototype$4 = objectCreate$1(IteratorPrototype$4);

// `%IteratorPrototype%[@@iterator]()` method
// https://tc39.es/ecma262/#sec-%iteratorprototype%-@@iterator
if (!isCallable$1(IteratorPrototype$4[ITERATOR$8])) {
  redefine$1(IteratorPrototype$4, ITERATOR$8, function () {
    return this;
  });
}

var iteratorsCore$1 = {
  IteratorPrototype: IteratorPrototype$4,
  BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS$3
};

// `Object.prototype.toString` method implementation
// https://tc39.es/ecma262/#sec-object.prototype.tostring
var objectToString = toStringTagSupport ? {}.toString : function toString() {
  return '[object ' + classof(this) + ']';
};

var defineProperty$3 = objectDefineProperty$1.f;





var TO_STRING_TAG$2 = wellKnownSymbol$1('toStringTag');

var setToStringTag$1 = function (it, TAG, STATIC, SET_METHOD) {
  if (it) {
    var target = STATIC ? it : it.prototype;
    if (!hasOwnProperty_1$1(target, TO_STRING_TAG$2)) {
      defineProperty$3(target, TO_STRING_TAG$2, { configurable: true, value: TAG });
    }
    if (SET_METHOD && !toStringTagSupport) {
      createNonEnumerableProperty$1(target, 'toString', objectToString);
    }
  }
};

var iterators$1 = {};

var IteratorPrototype$3 = iteratorsCore$1.IteratorPrototype;





var returnThis$3 = function () { return this; };

var createIteratorConstructor$1 = function (IteratorConstructor, NAME, next, ENUMERABLE_NEXT) {
  var TO_STRING_TAG = NAME + ' Iterator';
  IteratorConstructor.prototype = objectCreate$1(IteratorPrototype$3, { next: createPropertyDescriptor$1(+!ENUMERABLE_NEXT, next) });
  setToStringTag$1(IteratorConstructor, TO_STRING_TAG, false, true);
  iterators$1[TO_STRING_TAG] = returnThis$3;
  return IteratorConstructor;
};

var String$4 = global$2.String;
var TypeError$e = global$2.TypeError;

var aPossiblePrototype$1 = function (argument) {
  if (typeof argument == 'object' || isCallable$1(argument)) return argument;
  throw TypeError$e("Can't set " + String$4(argument) + ' as a prototype');
};

/* eslint-disable no-proto -- safe */

// `Object.setPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.setprototypeof
// Works with __proto__ only. Old v8 can't work with null proto objects.
// eslint-disable-next-line es/no-object-setprototypeof -- safe
Object.setPrototypeOf || ('__proto__' in {} ? function () {
  var CORRECT_SETTER = false;
  var test = {};
  var setter;
  try {
    // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
    setter = functionUncurryThis$1(Object.getOwnPropertyDescriptor(Object.prototype, '__proto__').set);
    setter(test, []);
    CORRECT_SETTER = test instanceof Array;
  } catch (error) { /* empty */ }
  return function setPrototypeOf(O, proto) {
    anObject$1(O);
    aPossiblePrototype$1(proto);
    if (CORRECT_SETTER) setter(O, proto);
    else O.__proto__ = proto;
    return O;
  };
}() : undefined);

var PROPER_FUNCTION_NAME$1 = functionName$1.PROPER;
var BUGGY_SAFARI_ITERATORS$2 = iteratorsCore$1.BUGGY_SAFARI_ITERATORS;
var ITERATOR$7 = wellKnownSymbol$1('iterator');
var KEYS$1 = 'keys';
var VALUES$1 = 'values';
var ENTRIES$1 = 'entries';

var returnThis$2 = function () { return this; };

var defineIterator$1 = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
  createIteratorConstructor$1(IteratorConstructor, NAME, next);

  var getIterationMethod = function (KIND) {
    if (KIND === DEFAULT && defaultIterator) return defaultIterator;
    if (!BUGGY_SAFARI_ITERATORS$2 && KIND in IterablePrototype) return IterablePrototype[KIND];
    switch (KIND) {
      case KEYS$1: return function keys() { return new IteratorConstructor(this, KIND); };
      case VALUES$1: return function values() { return new IteratorConstructor(this, KIND); };
      case ENTRIES$1: return function entries() { return new IteratorConstructor(this, KIND); };
    } return function () { return new IteratorConstructor(this); };
  };

  var TO_STRING_TAG = NAME + ' Iterator';
  var INCORRECT_VALUES_NAME = false;
  var IterablePrototype = Iterable.prototype;
  var nativeIterator = IterablePrototype[ITERATOR$7]
    || IterablePrototype['@@iterator']
    || DEFAULT && IterablePrototype[DEFAULT];
  var defaultIterator = !BUGGY_SAFARI_ITERATORS$2 && nativeIterator || getIterationMethod(DEFAULT);
  var anyNativeIterator = NAME == 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
  var CurrentIteratorPrototype, methods, KEY;

  // fix native
  if (anyNativeIterator) {
    CurrentIteratorPrototype = objectGetPrototypeOf$1(anyNativeIterator.call(new Iterable()));
    if (CurrentIteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
      // Set @@toStringTag to native iterators
      setToStringTag$1(CurrentIteratorPrototype, TO_STRING_TAG, true, true);
      iterators$1[TO_STRING_TAG] = returnThis$2;
    }
  }

  // fix Array.prototype.{ values, @@iterator }.name in V8 / FF
  if (PROPER_FUNCTION_NAME$1 && DEFAULT == VALUES$1 && nativeIterator && nativeIterator.name !== VALUES$1) {
    {
      INCORRECT_VALUES_NAME = true;
      defaultIterator = function values() { return functionCall$1(nativeIterator, this); };
    }
  }

  // export additional methods
  if (DEFAULT) {
    methods = {
      values: getIterationMethod(VALUES$1),
      keys: IS_SET ? defaultIterator : getIterationMethod(KEYS$1),
      entries: getIterationMethod(ENTRIES$1)
    };
    if (FORCED) for (KEY in methods) {
      if (BUGGY_SAFARI_ITERATORS$2 || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
        redefine$1(IterablePrototype, KEY, methods[KEY]);
      }
    } else _export$1({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS$2 || INCORRECT_VALUES_NAME }, methods);
  }

  // define iterator
  if ((FORCED) && IterablePrototype[ITERATOR$7] !== defaultIterator) {
    redefine$1(IterablePrototype, ITERATOR$7, defaultIterator, { name: DEFAULT });
  }
  iterators$1[NAME] = defaultIterator;

  return methods;
};

var charAt$3 = stringMultibyte.charAt;




var STRING_ITERATOR = 'String Iterator';
var setInternalState$4 = internalState$1.set;
var getInternalState$2 = internalState$1.getterFor(STRING_ITERATOR);

// `String.prototype[@@iterator]` method
// https://tc39.es/ecma262/#sec-string.prototype-@@iterator
defineIterator$1(String, 'String', function (iterated) {
  setInternalState$4(this, {
    type: STRING_ITERATOR,
    string: toString$2(iterated),
    index: 0
  });
// `%StringIteratorPrototype%.next` method
// https://tc39.es/ecma262/#sec-%stringiteratorprototype%.next
}, function next() {
  var state = getInternalState$2(this);
  var string = state.string;
  var index = state.index;
  var point;
  if (index >= string.length) return { value: undefined, done: true };
  point = charAt$3(string, index);
  state.index += point.length;
  return { value: point, done: false };
});

var ITERATOR$6 = wellKnownSymbol$1('iterator');

var nativeUrl = !fails$1(function () {
  var url = new URL('b?a=1&b=2&c=3', 'http://a');
  var searchParams = url.searchParams;
  var result = '';
  url.pathname = 'c%20d';
  searchParams.forEach(function (value, key) {
    searchParams['delete']('b');
    result += key + value;
  });
  return (isPure && !url.toJSON)
    || !searchParams.sort
    || url.href !== 'http://a/c%20d?a=1&c=3'
    || searchParams.get('c') !== '3'
    || String(new URLSearchParams('?a=1')) !== 'a=1'
    || !searchParams[ITERATOR$6]
    // throws in Edge
    || new URL('https://a@b').username !== 'a'
    || new URLSearchParams(new URLSearchParams('a=b')).get('a') !== 'b'
    // not punycoded in Edge
    || new URL('http://тест').host !== 'xn--e1aybc'
    // not escaped in Chrome 62-
    || new URL('http://a#б').hash !== '#%D0%B1'
    // fails in Chrome 66-
    || result !== 'a1c3'
    // throws in Safari
    || new URL('http://x', undefined).host !== 'x';
});

var TypeError$d = global$2.TypeError;

var anInstance = function (it, Prototype) {
  if (objectIsPrototypeOf$1(Prototype, it)) return it;
  throw TypeError$d('Incorrect invocation');
};

// eslint-disable-next-line es/no-object-getownpropertysymbols -- safe
var f$5 = Object.getOwnPropertySymbols;

var objectGetOwnPropertySymbols$1 = {
	f: f$5
};

// eslint-disable-next-line es/no-object-assign -- safe
var $assign = Object.assign;
// eslint-disable-next-line es/no-object-defineproperty -- required for testing
var defineProperty$2 = Object.defineProperty;
var concat$1 = functionUncurryThis$1([].concat);

// `Object.assign` method
// https://tc39.es/ecma262/#sec-object.assign
var objectAssign = !$assign || fails$1(function () {
  // should have correct order of operations (Edge bug)
  if (descriptors$1 && $assign({ b: 1 }, $assign(defineProperty$2({}, 'a', {
    enumerable: true,
    get: function () {
      defineProperty$2(this, 'b', {
        value: 3,
        enumerable: false
      });
    }
  }), { b: 2 })).b !== 1) return true;
  // should work with symbols and should have deterministic property order (V8 bug)
  var A = {};
  var B = {};
  // eslint-disable-next-line es/no-symbol -- safe
  var symbol = Symbol();
  var alphabet = 'abcdefghijklmnopqrst';
  A[symbol] = 7;
  alphabet.split('').forEach(function (chr) { B[chr] = chr; });
  return $assign({}, A)[symbol] != 7 || objectKeys$1($assign({}, B)).join('') != alphabet;
}) ? function assign(target, source) { // eslint-disable-line no-unused-vars -- required for `.length`
  var T = toObject$1(target);
  var argumentsLength = arguments.length;
  var index = 1;
  var getOwnPropertySymbols = objectGetOwnPropertySymbols$1.f;
  var propertyIsEnumerable = objectPropertyIsEnumerable$1.f;
  while (argumentsLength > index) {
    var S = indexedObject$1(arguments[index++]);
    var keys = getOwnPropertySymbols ? concat$1(objectKeys$1(S), getOwnPropertySymbols(S)) : objectKeys$1(S);
    var length = keys.length;
    var j = 0;
    var key;
    while (length > j) {
      key = keys[j++];
      if (!descriptors$1 || functionCall$1(propertyIsEnumerable, S, key)) T[key] = S[key];
    }
  } return T;
} : $assign;

var iteratorClose = function (iterator, kind, value) {
  var innerResult, innerError;
  anObject$1(iterator);
  try {
    innerResult = getMethod$1(iterator, 'return');
    if (!innerResult) {
      if (kind === 'throw') throw value;
      return value;
    }
    innerResult = functionCall$1(innerResult, iterator);
  } catch (error) {
    innerError = true;
    innerResult = error;
  }
  if (kind === 'throw') throw value;
  if (innerError) throw innerResult;
  anObject$1(innerResult);
  return value;
};

// call something on iterator step with safe closing on error
var callWithSafeIterationClosing = function (iterator, fn, value, ENTRIES) {
  try {
    return ENTRIES ? fn(anObject$1(value)[0], value[1]) : fn(value);
  } catch (error) {
    iteratorClose(iterator, 'throw', error);
  }
};

var ITERATOR$5 = wellKnownSymbol$1('iterator');
var ArrayPrototype$1 = Array.prototype;

// check on default Array iterator
var isArrayIteratorMethod = function (it) {
  return it !== undefined && (iterators$1.Array === it || ArrayPrototype$1[ITERATOR$5] === it);
};

var noop = function () { /* empty */ };
var empty = [];
var construct = getBuiltIn$1('Reflect', 'construct');
var constructorRegExp = /^\s*(?:class|function)\b/;
var exec$2 = functionUncurryThis$1(constructorRegExp.exec);
var INCORRECT_TO_STRING = !constructorRegExp.exec(noop);

var isConstructorModern = function (argument) {
  if (!isCallable$1(argument)) return false;
  try {
    construct(noop, empty, argument);
    return true;
  } catch (error) {
    return false;
  }
};

var isConstructorLegacy = function (argument) {
  if (!isCallable$1(argument)) return false;
  switch (classof(argument)) {
    case 'AsyncFunction':
    case 'GeneratorFunction':
    case 'AsyncGeneratorFunction': return false;
    // we can't check .prototype since constructors produced by .bind haven't it
  } return INCORRECT_TO_STRING || !!exec$2(constructorRegExp, inspectSource$1(argument));
};

// `IsConstructor` abstract operation
// https://tc39.es/ecma262/#sec-isconstructor
var isConstructor = !construct || fails$1(function () {
  var called;
  return isConstructorModern(isConstructorModern.call)
    || !isConstructorModern(Object)
    || !isConstructorModern(function () { called = true; })
    || called;
}) ? isConstructorLegacy : isConstructorModern;

var createProperty = function (object, key, value) {
  var propertyKey = toPropertyKey$1(key);
  if (propertyKey in object) objectDefineProperty$1.f(object, propertyKey, createPropertyDescriptor$1(0, value));
  else object[propertyKey] = value;
};

var ITERATOR$4 = wellKnownSymbol$1('iterator');

var getIteratorMethod = function (it) {
  if (it != undefined) return getMethod$1(it, ITERATOR$4)
    || getMethod$1(it, '@@iterator')
    || iterators$1[classof(it)];
};

var TypeError$c = global$2.TypeError;

var getIterator = function (argument, usingIterator) {
  var iteratorMethod = arguments.length < 2 ? getIteratorMethod(argument) : usingIterator;
  if (aCallable$1(iteratorMethod)) return anObject$1(functionCall$1(iteratorMethod, argument));
  throw TypeError$c(tryToString$1(argument) + ' is not iterable');
};

var Array$2 = global$2.Array;

// `Array.from` method implementation
// https://tc39.es/ecma262/#sec-array.from
var arrayFrom = function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
  var O = toObject$1(arrayLike);
  var IS_CONSTRUCTOR = isConstructor(this);
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var mapping = mapfn !== undefined;
  if (mapping) mapfn = functionBindContext(mapfn, argumentsLength > 2 ? arguments[2] : undefined);
  var iteratorMethod = getIteratorMethod(O);
  var index = 0;
  var length, result, step, iterator, next, value;
  // if the target is not iterable or it's an array with the default iterator - use a simple case
  if (iteratorMethod && !(this == Array$2 && isArrayIteratorMethod(iteratorMethod))) {
    iterator = getIterator(O, iteratorMethod);
    next = iterator.next;
    result = IS_CONSTRUCTOR ? new this() : [];
    for (;!(step = functionCall$1(next, iterator)).done; index++) {
      value = mapping ? callWithSafeIterationClosing(iterator, mapfn, [step.value, index], true) : step.value;
      createProperty(result, index, value);
    }
  } else {
    length = lengthOfArrayLike$1(O);
    result = IS_CONSTRUCTOR ? new this(length) : Array$2(length);
    for (;length > index; index++) {
      value = mapping ? mapfn(O[index], index) : O[index];
      createProperty(result, index, value);
    }
  }
  result.length = index;
  return result;
};

var Array$1 = global$2.Array;
var max$2 = Math.max;

var arraySliceSimple = function (O, start, end) {
  var length = lengthOfArrayLike$1(O);
  var k = toAbsoluteIndex$1(start, length);
  var fin = toAbsoluteIndex$1(end === undefined ? length : end, length);
  var result = Array$1(max$2(fin - k, 0));
  for (var n = 0; k < fin; k++, n++) createProperty(result, n, O[k]);
  result.length = n;
  return result;
};

// based on https://github.com/bestiejs/punycode.js/blob/master/punycode.js



var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128; // 0x80
var delimiter = '-'; // '\x2D'
var regexNonASCII = /[^\0-\u007E]/; // non-ASCII chars
var regexSeparators = /[.\u3002\uFF0E\uFF61]/g; // RFC 3490 separators
var OVERFLOW_ERROR = 'Overflow: input needs wider integers to process';
var baseMinusTMin = base - tMin;

var RangeError = global$2.RangeError;
var exec$1 = functionUncurryThis$1(regexSeparators.exec);
var floor$4 = Math.floor;
var fromCharCode = String.fromCharCode;
var charCodeAt = functionUncurryThis$1(''.charCodeAt);
var join$2 = functionUncurryThis$1([].join);
var push$4 = functionUncurryThis$1([].push);
var replace$4 = functionUncurryThis$1(''.replace);
var split$3 = functionUncurryThis$1(''.split);
var toLowerCase$1 = functionUncurryThis$1(''.toLowerCase);

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 */
var ucs2decode = function (string) {
  var output = [];
  var counter = 0;
  var length = string.length;
  while (counter < length) {
    var value = charCodeAt(string, counter++);
    if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
      // It's a high surrogate, and there is a next character.
      var extra = charCodeAt(string, counter++);
      if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
        push$4(output, ((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
      } else {
        // It's an unmatched surrogate; only append this code unit, in case the
        // next code unit is the high surrogate of a surrogate pair.
        push$4(output, value);
        counter--;
      }
    } else {
      push$4(output, value);
    }
  }
  return output;
};

/**
 * Converts a digit/integer into a basic code point.
 */
var digitToBasic = function (digit) {
  //  0..25 map to ASCII a..z or A..Z
  // 26..35 map to ASCII 0..9
  return digit + 22 + 75 * (digit < 26);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 */
var adapt = function (delta, numPoints, firstTime) {
  var k = 0;
  delta = firstTime ? floor$4(delta / damp) : delta >> 1;
  delta += floor$4(delta / numPoints);
  while (delta > baseMinusTMin * tMax >> 1) {
    delta = floor$4(delta / baseMinusTMin);
    k += base;
  }
  return floor$4(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 */
var encode = function (input) {
  var output = [];

  // Convert the input in UCS-2 to an array of Unicode code points.
  input = ucs2decode(input);

  // Cache the length.
  var inputLength = input.length;

  // Initialize the state.
  var n = initialN;
  var delta = 0;
  var bias = initialBias;
  var i, currentValue;

  // Handle the basic code points.
  for (i = 0; i < input.length; i++) {
    currentValue = input[i];
    if (currentValue < 0x80) {
      push$4(output, fromCharCode(currentValue));
    }
  }

  var basicLength = output.length; // number of basic code points.
  var handledCPCount = basicLength; // number of code points that have been handled;

  // Finish the basic string with a delimiter unless it's empty.
  if (basicLength) {
    push$4(output, delimiter);
  }

  // Main encoding loop:
  while (handledCPCount < inputLength) {
    // All non-basic code points < n have been handled already. Find the next larger one:
    var m = maxInt;
    for (i = 0; i < input.length; i++) {
      currentValue = input[i];
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }

    // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>, but guard against overflow.
    var handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor$4((maxInt - delta) / handledCPCountPlusOne)) {
      throw RangeError(OVERFLOW_ERROR);
    }

    delta += (m - n) * handledCPCountPlusOne;
    n = m;

    for (i = 0; i < input.length; i++) {
      currentValue = input[i];
      if (currentValue < n && ++delta > maxInt) {
        throw RangeError(OVERFLOW_ERROR);
      }
      if (currentValue == n) {
        // Represent delta as a generalized variable-length integer.
        var q = delta;
        var k = base;
        while (true) {
          var t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
          if (q < t) break;
          var qMinusT = q - t;
          var baseMinusT = base - t;
          push$4(output, fromCharCode(digitToBasic(t + qMinusT % baseMinusT)));
          q = floor$4(qMinusT / baseMinusT);
          k += base;
        }

        push$4(output, fromCharCode(digitToBasic(q)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
        delta = 0;
        handledCPCount++;
      }
    }

    delta++;
    n++;
  }
  return join$2(output, '');
};

var stringPunycodeToAscii = function (input) {
  var encoded = [];
  var labels = split$3(replace$4(toLowerCase$1(input), regexSeparators, '\u002E'), '.');
  var i, label;
  for (i = 0; i < labels.length; i++) {
    label = labels[i];
    push$4(encoded, exec$1(regexNonASCII, label) ? 'xn--' + encode(label) : label);
  }
  return join$2(encoded, '.');
};

var ARRAY_ITERATOR$1 = 'Array Iterator';
var setInternalState$3 = internalState$1.set;
var getInternalState$1 = internalState$1.getterFor(ARRAY_ITERATOR$1);

// `Array.prototype.entries` method
// https://tc39.es/ecma262/#sec-array.prototype.entries
// `Array.prototype.keys` method
// https://tc39.es/ecma262/#sec-array.prototype.keys
// `Array.prototype.values` method
// https://tc39.es/ecma262/#sec-array.prototype.values
// `Array.prototype[@@iterator]` method
// https://tc39.es/ecma262/#sec-array.prototype-@@iterator
// `CreateArrayIterator` internal method
// https://tc39.es/ecma262/#sec-createarrayiterator
defineIterator$1(Array, 'Array', function (iterated, kind) {
  setInternalState$3(this, {
    type: ARRAY_ITERATOR$1,
    target: toIndexedObject$1(iterated), // target
    index: 0,                          // next index
    kind: kind                         // kind
  });
// `%ArrayIteratorPrototype%.next` method
// https://tc39.es/ecma262/#sec-%arrayiteratorprototype%.next
}, function () {
  var state = getInternalState$1(this);
  var target = state.target;
  var kind = state.kind;
  var index = state.index++;
  if (!target || index >= target.length) {
    state.target = undefined;
    return { value: undefined, done: true };
  }
  if (kind == 'keys') return { value: index, done: false };
  if (kind == 'values') return { value: target[index], done: false };
  return { value: [index, target[index]], done: false };
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values%
// https://tc39.es/ecma262/#sec-createunmappedargumentsobject
// https://tc39.es/ecma262/#sec-createmappedargumentsobject
iterators$1.Arguments = iterators$1.Array;

var redefineAll = function (target, src, options) {
  for (var key in src) {
    if (options && options.unsafe && target[key]) target[key] = src[key];
    else redefine$1(target, key, src[key], options);
  } return target;
};

var floor$3 = Math.floor;

var mergeSort = function (array, comparefn) {
  var length = array.length;
  var middle = floor$3(length / 2);
  return length < 8 ? insertionSort(array, comparefn) : merge(
    array,
    mergeSort(arraySliceSimple(array, 0, middle), comparefn),
    mergeSort(arraySliceSimple(array, middle), comparefn),
    comparefn
  );
};

var insertionSort = function (array, comparefn) {
  var length = array.length;
  var i = 1;
  var element, j;

  while (i < length) {
    j = i;
    element = array[i];
    while (j && comparefn(array[j - 1], element) > 0) {
      array[j] = array[--j];
    }
    if (j !== i++) array[j] = element;
  } return array;
};

var merge = function (array, left, right, comparefn) {
  var llength = left.length;
  var rlength = right.length;
  var lindex = 0;
  var rindex = 0;

  while (lindex < llength || rindex < rlength) {
    array[lindex + rindex] = (lindex < llength && rindex < rlength)
      ? comparefn(left[lindex], right[rindex]) <= 0 ? left[lindex++] : right[rindex++]
      : lindex < llength ? left[lindex++] : right[rindex++];
  } return array;
};

var arraySort = mergeSort;

// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`



























var ITERATOR$3 = wellKnownSymbol$1('iterator');
var URL_SEARCH_PARAMS = 'URLSearchParams';
var URL_SEARCH_PARAMS_ITERATOR = URL_SEARCH_PARAMS + 'Iterator';
var setInternalState$2 = internalState$1.set;
var getInternalParamsState = internalState$1.getterFor(URL_SEARCH_PARAMS);
var getInternalIteratorState = internalState$1.getterFor(URL_SEARCH_PARAMS_ITERATOR);

var n$Fetch = getBuiltIn$1('fetch');
var N$Request = getBuiltIn$1('Request');
var Headers = getBuiltIn$1('Headers');
var RequestPrototype = N$Request && N$Request.prototype;
var HeadersPrototype = Headers && Headers.prototype;
var RegExp$1 = global$2.RegExp;
var TypeError$b = global$2.TypeError;
var decodeURIComponent$1 = global$2.decodeURIComponent;
var encodeURIComponent$1 = global$2.encodeURIComponent;
var charAt$2 = functionUncurryThis$1(''.charAt);
var join$1 = functionUncurryThis$1([].join);
var push$3 = functionUncurryThis$1([].push);
var replace$3 = functionUncurryThis$1(''.replace);
var shift$1 = functionUncurryThis$1([].shift);
var splice = functionUncurryThis$1([].splice);
var split$2 = functionUncurryThis$1(''.split);
var stringSlice$4 = functionUncurryThis$1(''.slice);

var plus = /\+/g;
var sequences = Array(4);

var percentSequence = function (bytes) {
  return sequences[bytes - 1] || (sequences[bytes - 1] = RegExp$1('((?:%[\\da-f]{2}){' + bytes + '})', 'gi'));
};

var percentDecode = function (sequence) {
  try {
    return decodeURIComponent$1(sequence);
  } catch (error) {
    return sequence;
  }
};

var deserialize = function (it) {
  var result = replace$3(it, plus, ' ');
  var bytes = 4;
  try {
    return decodeURIComponent$1(result);
  } catch (error) {
    while (bytes) {
      result = replace$3(result, percentSequence(bytes--), percentDecode);
    }
    return result;
  }
};

var find = /[!'()~]|%20/g;

var replacements = {
  '!': '%21',
  "'": '%27',
  '(': '%28',
  ')': '%29',
  '~': '%7E',
  '%20': '+'
};

var replacer = function (match) {
  return replacements[match];
};

var serialize = function (it) {
  return replace$3(encodeURIComponent$1(it), find, replacer);
};

var validateArgumentsLength = function (passed, required) {
  if (passed < required) throw TypeError$b('Not enough arguments');
};

var URLSearchParamsIterator = createIteratorConstructor$1(function Iterator(params, kind) {
  setInternalState$2(this, {
    type: URL_SEARCH_PARAMS_ITERATOR,
    iterator: getIterator(getInternalParamsState(params).entries),
    kind: kind
  });
}, 'Iterator', function next() {
  var state = getInternalIteratorState(this);
  var kind = state.kind;
  var step = state.iterator.next();
  var entry = step.value;
  if (!step.done) {
    step.value = kind === 'keys' ? entry.key : kind === 'values' ? entry.value : [entry.key, entry.value];
  } return step;
}, true);

var URLSearchParamsState = function (init) {
  this.entries = [];
  this.url = null;

  if (init !== undefined) {
    if (isObject$1(init)) this.parseObject(init);
    else this.parseQuery(typeof init == 'string' ? charAt$2(init, 0) === '?' ? stringSlice$4(init, 1) : init : toString$2(init));
  }
};

URLSearchParamsState.prototype = {
  type: URL_SEARCH_PARAMS,
  bindURL: function (url) {
    this.url = url;
    this.update();
  },
  parseObject: function (object) {
    var iteratorMethod = getIteratorMethod(object);
    var iterator, next, step, entryIterator, entryNext, first, second;

    if (iteratorMethod) {
      iterator = getIterator(object, iteratorMethod);
      next = iterator.next;
      while (!(step = functionCall$1(next, iterator)).done) {
        entryIterator = getIterator(anObject$1(step.value));
        entryNext = entryIterator.next;
        if (
          (first = functionCall$1(entryNext, entryIterator)).done ||
          (second = functionCall$1(entryNext, entryIterator)).done ||
          !functionCall$1(entryNext, entryIterator).done
        ) throw TypeError$b('Expected sequence with length 2');
        push$3(this.entries, { key: toString$2(first.value), value: toString$2(second.value) });
      }
    } else for (var key in object) if (hasOwnProperty_1$1(object, key)) {
      push$3(this.entries, { key: key, value: toString$2(object[key]) });
    }
  },
  parseQuery: function (query) {
    if (query) {
      var attributes = split$2(query, '&');
      var index = 0;
      var attribute, entry;
      while (index < attributes.length) {
        attribute = attributes[index++];
        if (attribute.length) {
          entry = split$2(attribute, '=');
          push$3(this.entries, {
            key: deserialize(shift$1(entry)),
            value: deserialize(join$1(entry, '='))
          });
        }
      }
    }
  },
  serialize: function () {
    var entries = this.entries;
    var result = [];
    var index = 0;
    var entry;
    while (index < entries.length) {
      entry = entries[index++];
      push$3(result, serialize(entry.key) + '=' + serialize(entry.value));
    } return join$1(result, '&');
  },
  update: function () {
    this.entries.length = 0;
    this.parseQuery(this.url.query);
  },
  updateURL: function () {
    if (this.url) this.url.update();
  }
};

// `URLSearchParams` constructor
// https://url.spec.whatwg.org/#interface-urlsearchparams
var URLSearchParamsConstructor = function URLSearchParams(/* init */) {
  anInstance(this, URLSearchParamsPrototype);
  var init = arguments.length > 0 ? arguments[0] : undefined;
  setInternalState$2(this, new URLSearchParamsState(init));
};

var URLSearchParamsPrototype = URLSearchParamsConstructor.prototype;

redefineAll(URLSearchParamsPrototype, {
  // `URLSearchParams.prototype.append` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-append
  append: function append(name, value) {
    validateArgumentsLength(arguments.length, 2);
    var state = getInternalParamsState(this);
    push$3(state.entries, { key: toString$2(name), value: toString$2(value) });
    state.updateURL();
  },
  // `URLSearchParams.prototype.delete` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-delete
  'delete': function (name) {
    validateArgumentsLength(arguments.length, 1);
    var state = getInternalParamsState(this);
    var entries = state.entries;
    var key = toString$2(name);
    var index = 0;
    while (index < entries.length) {
      if (entries[index].key === key) splice(entries, index, 1);
      else index++;
    }
    state.updateURL();
  },
  // `URLSearchParams.prototype.get` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-get
  get: function get(name) {
    validateArgumentsLength(arguments.length, 1);
    var entries = getInternalParamsState(this).entries;
    var key = toString$2(name);
    var index = 0;
    for (; index < entries.length; index++) {
      if (entries[index].key === key) return entries[index].value;
    }
    return null;
  },
  // `URLSearchParams.prototype.getAll` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-getall
  getAll: function getAll(name) {
    validateArgumentsLength(arguments.length, 1);
    var entries = getInternalParamsState(this).entries;
    var key = toString$2(name);
    var result = [];
    var index = 0;
    for (; index < entries.length; index++) {
      if (entries[index].key === key) push$3(result, entries[index].value);
    }
    return result;
  },
  // `URLSearchParams.prototype.has` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-has
  has: function has(name) {
    validateArgumentsLength(arguments.length, 1);
    var entries = getInternalParamsState(this).entries;
    var key = toString$2(name);
    var index = 0;
    while (index < entries.length) {
      if (entries[index++].key === key) return true;
    }
    return false;
  },
  // `URLSearchParams.prototype.set` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-set
  set: function set(name, value) {
    validateArgumentsLength(arguments.length, 1);
    var state = getInternalParamsState(this);
    var entries = state.entries;
    var found = false;
    var key = toString$2(name);
    var val = toString$2(value);
    var index = 0;
    var entry;
    for (; index < entries.length; index++) {
      entry = entries[index];
      if (entry.key === key) {
        if (found) splice(entries, index--, 1);
        else {
          found = true;
          entry.value = val;
        }
      }
    }
    if (!found) push$3(entries, { key: key, value: val });
    state.updateURL();
  },
  // `URLSearchParams.prototype.sort` method
  // https://url.spec.whatwg.org/#dom-urlsearchparams-sort
  sort: function sort() {
    var state = getInternalParamsState(this);
    arraySort(state.entries, function (a, b) {
      return a.key > b.key ? 1 : -1;
    });
    state.updateURL();
  },
  // `URLSearchParams.prototype.forEach` method
  forEach: function forEach(callback /* , thisArg */) {
    var entries = getInternalParamsState(this).entries;
    var boundFunction = functionBindContext(callback, arguments.length > 1 ? arguments[1] : undefined);
    var index = 0;
    var entry;
    while (index < entries.length) {
      entry = entries[index++];
      boundFunction(entry.value, entry.key, this);
    }
  },
  // `URLSearchParams.prototype.keys` method
  keys: function keys() {
    return new URLSearchParamsIterator(this, 'keys');
  },
  // `URLSearchParams.prototype.values` method
  values: function values() {
    return new URLSearchParamsIterator(this, 'values');
  },
  // `URLSearchParams.prototype.entries` method
  entries: function entries() {
    return new URLSearchParamsIterator(this, 'entries');
  }
}, { enumerable: true });

// `URLSearchParams.prototype[@@iterator]` method
redefine$1(URLSearchParamsPrototype, ITERATOR$3, URLSearchParamsPrototype.entries, { name: 'entries' });

// `URLSearchParams.prototype.toString` method
// https://url.spec.whatwg.org/#urlsearchparams-stringification-behavior
redefine$1(URLSearchParamsPrototype, 'toString', function toString() {
  return getInternalParamsState(this).serialize();
}, { enumerable: true });

setToStringTag$1(URLSearchParamsConstructor, URL_SEARCH_PARAMS);

_export$1({ global: true, forced: !nativeUrl }, {
  URLSearchParams: URLSearchParamsConstructor
});

// Wrap `fetch` and `Request` for correct work with polyfilled `URLSearchParams`
if (!nativeUrl && isCallable$1(Headers)) {
  var headersHas = functionUncurryThis$1(HeadersPrototype.has);
  var headersSet = functionUncurryThis$1(HeadersPrototype.set);

  var wrapRequestOptions = function (init) {
    if (isObject$1(init)) {
      var body = init.body;
      var headers;
      if (classof(body) === URL_SEARCH_PARAMS) {
        headers = init.headers ? new Headers(init.headers) : new Headers();
        if (!headersHas(headers, 'content-type')) {
          headersSet(headers, 'content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
        return objectCreate$1(init, {
          body: createPropertyDescriptor$1(0, toString$2(body)),
          headers: createPropertyDescriptor$1(0, headers)
        });
      }
    } return init;
  };

  if (isCallable$1(n$Fetch)) {
    _export$1({ global: true, enumerable: true, forced: true }, {
      fetch: function fetch(input /* , init */) {
        return n$Fetch(input, arguments.length > 1 ? wrapRequestOptions(arguments[1]) : {});
      }
    });
  }

  if (isCallable$1(N$Request)) {
    var RequestConstructor = function Request(input /* , init */) {
      anInstance(this, RequestPrototype);
      return new N$Request(input, arguments.length > 1 ? wrapRequestOptions(arguments[1]) : {});
    };

    RequestPrototype.constructor = RequestConstructor;
    RequestConstructor.prototype = RequestPrototype;

    _export$1({ global: true, forced: true }, {
      Request: RequestConstructor
    });
  }
}

var web_urlSearchParams = {
  URLSearchParams: URLSearchParamsConstructor,
  getState: getInternalParamsState
};

// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`














var codeAt = stringMultibyte.codeAt;






var setInternalState$1 = internalState$1.set;
var getInternalURLState = internalState$1.getterFor('URL');
var URLSearchParams$1 = web_urlSearchParams.URLSearchParams;
var getInternalSearchParamsState = web_urlSearchParams.getState;

var NativeURL = global$2.URL;
var TypeError$a = global$2.TypeError;
var parseInt = global$2.parseInt;
var floor$2 = Math.floor;
var pow = Math.pow;
var charAt$1 = functionUncurryThis$1(''.charAt);
var exec = functionUncurryThis$1(/./.exec);
var join = functionUncurryThis$1([].join);
var numberToString = functionUncurryThis$1(1.0.toString);
var pop = functionUncurryThis$1([].pop);
var push$2 = functionUncurryThis$1([].push);
var replace$2 = functionUncurryThis$1(''.replace);
var shift = functionUncurryThis$1([].shift);
var split$1 = functionUncurryThis$1(''.split);
var stringSlice$3 = functionUncurryThis$1(''.slice);
var toLowerCase = functionUncurryThis$1(''.toLowerCase);
var unshift = functionUncurryThis$1([].unshift);

var INVALID_AUTHORITY = 'Invalid authority';
var INVALID_SCHEME = 'Invalid scheme';
var INVALID_HOST = 'Invalid host';
var INVALID_PORT = 'Invalid port';

var ALPHA = /[a-z]/i;
// eslint-disable-next-line regexp/no-obscure-range -- safe
var ALPHANUMERIC = /[\d+-.a-z]/i;
var DIGIT = /\d/;
var HEX_START = /^0x/i;
var OCT = /^[0-7]+$/;
var DEC = /^\d+$/;
var HEX = /^[\da-f]+$/i;
/* eslint-disable regexp/no-control-character -- safe */
var FORBIDDEN_HOST_CODE_POINT = /[\0\t\n\r #%/:<>?@[\\\]^|]/;
var FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT = /[\0\t\n\r #/:<>?@[\\\]^|]/;
var LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;
var TAB_AND_NEW_LINE = /[\t\n\r]/g;
/* eslint-enable regexp/no-control-character -- safe */
var EOF;

// https://url.spec.whatwg.org/#ipv4-number-parser
var parseIPv4 = function (input) {
  var parts = split$1(input, '.');
  var partsLength, numbers, index, part, radix, number, ipv4;
  if (parts.length && parts[parts.length - 1] == '') {
    parts.length--;
  }
  partsLength = parts.length;
  if (partsLength > 4) return input;
  numbers = [];
  for (index = 0; index < partsLength; index++) {
    part = parts[index];
    if (part == '') return input;
    radix = 10;
    if (part.length > 1 && charAt$1(part, 0) == '0') {
      radix = exec(HEX_START, part) ? 16 : 8;
      part = stringSlice$3(part, radix == 8 ? 1 : 2);
    }
    if (part === '') {
      number = 0;
    } else {
      if (!exec(radix == 10 ? DEC : radix == 8 ? OCT : HEX, part)) return input;
      number = parseInt(part, radix);
    }
    push$2(numbers, number);
  }
  for (index = 0; index < partsLength; index++) {
    number = numbers[index];
    if (index == partsLength - 1) {
      if (number >= pow(256, 5 - partsLength)) return null;
    } else if (number > 255) return null;
  }
  ipv4 = pop(numbers);
  for (index = 0; index < numbers.length; index++) {
    ipv4 += numbers[index] * pow(256, 3 - index);
  }
  return ipv4;
};

// https://url.spec.whatwg.org/#concept-ipv6-parser
// eslint-disable-next-line max-statements -- TODO
var parseIPv6 = function (input) {
  var address = [0, 0, 0, 0, 0, 0, 0, 0];
  var pieceIndex = 0;
  var compress = null;
  var pointer = 0;
  var value, length, numbersSeen, ipv4Piece, number, swaps, swap;

  var chr = function () {
    return charAt$1(input, pointer);
  };

  if (chr() == ':') {
    if (charAt$1(input, 1) != ':') return;
    pointer += 2;
    pieceIndex++;
    compress = pieceIndex;
  }
  while (chr()) {
    if (pieceIndex == 8) return;
    if (chr() == ':') {
      if (compress !== null) return;
      pointer++;
      pieceIndex++;
      compress = pieceIndex;
      continue;
    }
    value = length = 0;
    while (length < 4 && exec(HEX, chr())) {
      value = value * 16 + parseInt(chr(), 16);
      pointer++;
      length++;
    }
    if (chr() == '.') {
      if (length == 0) return;
      pointer -= length;
      if (pieceIndex > 6) return;
      numbersSeen = 0;
      while (chr()) {
        ipv4Piece = null;
        if (numbersSeen > 0) {
          if (chr() == '.' && numbersSeen < 4) pointer++;
          else return;
        }
        if (!exec(DIGIT, chr())) return;
        while (exec(DIGIT, chr())) {
          number = parseInt(chr(), 10);
          if (ipv4Piece === null) ipv4Piece = number;
          else if (ipv4Piece == 0) return;
          else ipv4Piece = ipv4Piece * 10 + number;
          if (ipv4Piece > 255) return;
          pointer++;
        }
        address[pieceIndex] = address[pieceIndex] * 256 + ipv4Piece;
        numbersSeen++;
        if (numbersSeen == 2 || numbersSeen == 4) pieceIndex++;
      }
      if (numbersSeen != 4) return;
      break;
    } else if (chr() == ':') {
      pointer++;
      if (!chr()) return;
    } else if (chr()) return;
    address[pieceIndex++] = value;
  }
  if (compress !== null) {
    swaps = pieceIndex - compress;
    pieceIndex = 7;
    while (pieceIndex != 0 && swaps > 0) {
      swap = address[pieceIndex];
      address[pieceIndex--] = address[compress + swaps - 1];
      address[compress + --swaps] = swap;
    }
  } else if (pieceIndex != 8) return;
  return address;
};

var findLongestZeroSequence = function (ipv6) {
  var maxIndex = null;
  var maxLength = 1;
  var currStart = null;
  var currLength = 0;
  var index = 0;
  for (; index < 8; index++) {
    if (ipv6[index] !== 0) {
      if (currLength > maxLength) {
        maxIndex = currStart;
        maxLength = currLength;
      }
      currStart = null;
      currLength = 0;
    } else {
      if (currStart === null) currStart = index;
      ++currLength;
    }
  }
  if (currLength > maxLength) {
    maxIndex = currStart;
    maxLength = currLength;
  }
  return maxIndex;
};

// https://url.spec.whatwg.org/#host-serializing
var serializeHost = function (host) {
  var result, index, compress, ignore0;
  // ipv4
  if (typeof host == 'number') {
    result = [];
    for (index = 0; index < 4; index++) {
      unshift(result, host % 256);
      host = floor$2(host / 256);
    } return join(result, '.');
  // ipv6
  } else if (typeof host == 'object') {
    result = '';
    compress = findLongestZeroSequence(host);
    for (index = 0; index < 8; index++) {
      if (ignore0 && host[index] === 0) continue;
      if (ignore0) ignore0 = false;
      if (compress === index) {
        result += index ? ':' : '::';
        ignore0 = true;
      } else {
        result += numberToString(host[index], 16);
        if (index < 7) result += ':';
      }
    }
    return '[' + result + ']';
  } return host;
};

var C0ControlPercentEncodeSet = {};
var fragmentPercentEncodeSet = objectAssign({}, C0ControlPercentEncodeSet, {
  ' ': 1, '"': 1, '<': 1, '>': 1, '`': 1
});
var pathPercentEncodeSet = objectAssign({}, fragmentPercentEncodeSet, {
  '#': 1, '?': 1, '{': 1, '}': 1
});
var userinfoPercentEncodeSet = objectAssign({}, pathPercentEncodeSet, {
  '/': 1, ':': 1, ';': 1, '=': 1, '@': 1, '[': 1, '\\': 1, ']': 1, '^': 1, '|': 1
});

var percentEncode = function (chr, set) {
  var code = codeAt(chr, 0);
  return code > 0x20 && code < 0x7F && !hasOwnProperty_1$1(set, chr) ? chr : encodeURIComponent(chr);
};

// https://url.spec.whatwg.org/#special-scheme
var specialSchemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};

// https://url.spec.whatwg.org/#windows-drive-letter
var isWindowsDriveLetter = function (string, normalized) {
  var second;
  return string.length == 2 && exec(ALPHA, charAt$1(string, 0))
    && ((second = charAt$1(string, 1)) == ':' || (!normalized && second == '|'));
};

// https://url.spec.whatwg.org/#start-with-a-windows-drive-letter
var startsWithWindowsDriveLetter = function (string) {
  var third;
  return string.length > 1 && isWindowsDriveLetter(stringSlice$3(string, 0, 2)) && (
    string.length == 2 ||
    ((third = charAt$1(string, 2)) === '/' || third === '\\' || third === '?' || third === '#')
  );
};

// https://url.spec.whatwg.org/#single-dot-path-segment
var isSingleDot = function (segment) {
  return segment === '.' || toLowerCase(segment) === '%2e';
};

// https://url.spec.whatwg.org/#double-dot-path-segment
var isDoubleDot = function (segment) {
  segment = toLowerCase(segment);
  return segment === '..' || segment === '%2e.' || segment === '.%2e' || segment === '%2e%2e';
};

// States:
var SCHEME_START = {};
var SCHEME = {};
var NO_SCHEME = {};
var SPECIAL_RELATIVE_OR_AUTHORITY = {};
var PATH_OR_AUTHORITY = {};
var RELATIVE = {};
var RELATIVE_SLASH = {};
var SPECIAL_AUTHORITY_SLASHES = {};
var SPECIAL_AUTHORITY_IGNORE_SLASHES = {};
var AUTHORITY = {};
var HOST = {};
var HOSTNAME = {};
var PORT = {};
var FILE = {};
var FILE_SLASH = {};
var FILE_HOST = {};
var PATH_START = {};
var PATH = {};
var CANNOT_BE_A_BASE_URL_PATH = {};
var QUERY = {};
var FRAGMENT = {};

var URLState = function (url, isBase, base) {
  var urlString = toString$2(url);
  var baseState, failure, searchParams;
  if (isBase) {
    failure = this.parse(urlString);
    if (failure) throw TypeError$a(failure);
    this.searchParams = null;
  } else {
    if (base !== undefined) baseState = new URLState(base, true);
    failure = this.parse(urlString, null, baseState);
    if (failure) throw TypeError$a(failure);
    searchParams = getInternalSearchParamsState(new URLSearchParams$1());
    searchParams.bindURL(this);
    this.searchParams = searchParams;
  }
};

URLState.prototype = {
  type: 'URL',
  // https://url.spec.whatwg.org/#url-parsing
  // eslint-disable-next-line max-statements -- TODO
  parse: function (input, stateOverride, base) {
    var url = this;
    var state = stateOverride || SCHEME_START;
    var pointer = 0;
    var buffer = '';
    var seenAt = false;
    var seenBracket = false;
    var seenPasswordToken = false;
    var codePoints, chr, bufferCodePoints, failure;

    input = toString$2(input);

    if (!stateOverride) {
      url.scheme = '';
      url.username = '';
      url.password = '';
      url.host = null;
      url.port = null;
      url.path = [];
      url.query = null;
      url.fragment = null;
      url.cannotBeABaseURL = false;
      input = replace$2(input, LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE, '');
    }

    input = replace$2(input, TAB_AND_NEW_LINE, '');

    codePoints = arrayFrom(input);

    while (pointer <= codePoints.length) {
      chr = codePoints[pointer];
      switch (state) {
        case SCHEME_START:
          if (chr && exec(ALPHA, chr)) {
            buffer += toLowerCase(chr);
            state = SCHEME;
          } else if (!stateOverride) {
            state = NO_SCHEME;
            continue;
          } else return INVALID_SCHEME;
          break;

        case SCHEME:
          if (chr && (exec(ALPHANUMERIC, chr) || chr == '+' || chr == '-' || chr == '.')) {
            buffer += toLowerCase(chr);
          } else if (chr == ':') {
            if (stateOverride && (
              (url.isSpecial() != hasOwnProperty_1$1(specialSchemes, buffer)) ||
              (buffer == 'file' && (url.includesCredentials() || url.port !== null)) ||
              (url.scheme == 'file' && !url.host)
            )) return;
            url.scheme = buffer;
            if (stateOverride) {
              if (url.isSpecial() && specialSchemes[url.scheme] == url.port) url.port = null;
              return;
            }
            buffer = '';
            if (url.scheme == 'file') {
              state = FILE;
            } else if (url.isSpecial() && base && base.scheme == url.scheme) {
              state = SPECIAL_RELATIVE_OR_AUTHORITY;
            } else if (url.isSpecial()) {
              state = SPECIAL_AUTHORITY_SLASHES;
            } else if (codePoints[pointer + 1] == '/') {
              state = PATH_OR_AUTHORITY;
              pointer++;
            } else {
              url.cannotBeABaseURL = true;
              push$2(url.path, '');
              state = CANNOT_BE_A_BASE_URL_PATH;
            }
          } else if (!stateOverride) {
            buffer = '';
            state = NO_SCHEME;
            pointer = 0;
            continue;
          } else return INVALID_SCHEME;
          break;

        case NO_SCHEME:
          if (!base || (base.cannotBeABaseURL && chr != '#')) return INVALID_SCHEME;
          if (base.cannotBeABaseURL && chr == '#') {
            url.scheme = base.scheme;
            url.path = arraySliceSimple(base.path);
            url.query = base.query;
            url.fragment = '';
            url.cannotBeABaseURL = true;
            state = FRAGMENT;
            break;
          }
          state = base.scheme == 'file' ? FILE : RELATIVE;
          continue;

        case SPECIAL_RELATIVE_OR_AUTHORITY:
          if (chr == '/' && codePoints[pointer + 1] == '/') {
            state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
            pointer++;
          } else {
            state = RELATIVE;
            continue;
          } break;

        case PATH_OR_AUTHORITY:
          if (chr == '/') {
            state = AUTHORITY;
            break;
          } else {
            state = PATH;
            continue;
          }

        case RELATIVE:
          url.scheme = base.scheme;
          if (chr == EOF) {
            url.username = base.username;
            url.password = base.password;
            url.host = base.host;
            url.port = base.port;
            url.path = arraySliceSimple(base.path);
            url.query = base.query;
          } else if (chr == '/' || (chr == '\\' && url.isSpecial())) {
            state = RELATIVE_SLASH;
          } else if (chr == '?') {
            url.username = base.username;
            url.password = base.password;
            url.host = base.host;
            url.port = base.port;
            url.path = arraySliceSimple(base.path);
            url.query = '';
            state = QUERY;
          } else if (chr == '#') {
            url.username = base.username;
            url.password = base.password;
            url.host = base.host;
            url.port = base.port;
            url.path = arraySliceSimple(base.path);
            url.query = base.query;
            url.fragment = '';
            state = FRAGMENT;
          } else {
            url.username = base.username;
            url.password = base.password;
            url.host = base.host;
            url.port = base.port;
            url.path = arraySliceSimple(base.path);
            url.path.length--;
            state = PATH;
            continue;
          } break;

        case RELATIVE_SLASH:
          if (url.isSpecial() && (chr == '/' || chr == '\\')) {
            state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
          } else if (chr == '/') {
            state = AUTHORITY;
          } else {
            url.username = base.username;
            url.password = base.password;
            url.host = base.host;
            url.port = base.port;
            state = PATH;
            continue;
          } break;

        case SPECIAL_AUTHORITY_SLASHES:
          state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
          if (chr != '/' || charAt$1(buffer, pointer + 1) != '/') continue;
          pointer++;
          break;

        case SPECIAL_AUTHORITY_IGNORE_SLASHES:
          if (chr != '/' && chr != '\\') {
            state = AUTHORITY;
            continue;
          } break;

        case AUTHORITY:
          if (chr == '@') {
            if (seenAt) buffer = '%40' + buffer;
            seenAt = true;
            bufferCodePoints = arrayFrom(buffer);
            for (var i = 0; i < bufferCodePoints.length; i++) {
              var codePoint = bufferCodePoints[i];
              if (codePoint == ':' && !seenPasswordToken) {
                seenPasswordToken = true;
                continue;
              }
              var encodedCodePoints = percentEncode(codePoint, userinfoPercentEncodeSet);
              if (seenPasswordToken) url.password += encodedCodePoints;
              else url.username += encodedCodePoints;
            }
            buffer = '';
          } else if (
            chr == EOF || chr == '/' || chr == '?' || chr == '#' ||
            (chr == '\\' && url.isSpecial())
          ) {
            if (seenAt && buffer == '') return INVALID_AUTHORITY;
            pointer -= arrayFrom(buffer).length + 1;
            buffer = '';
            state = HOST;
          } else buffer += chr;
          break;

        case HOST:
        case HOSTNAME:
          if (stateOverride && url.scheme == 'file') {
            state = FILE_HOST;
            continue;
          } else if (chr == ':' && !seenBracket) {
            if (buffer == '') return INVALID_HOST;
            failure = url.parseHost(buffer);
            if (failure) return failure;
            buffer = '';
            state = PORT;
            if (stateOverride == HOSTNAME) return;
          } else if (
            chr == EOF || chr == '/' || chr == '?' || chr == '#' ||
            (chr == '\\' && url.isSpecial())
          ) {
            if (url.isSpecial() && buffer == '') return INVALID_HOST;
            if (stateOverride && buffer == '' && (url.includesCredentials() || url.port !== null)) return;
            failure = url.parseHost(buffer);
            if (failure) return failure;
            buffer = '';
            state = PATH_START;
            if (stateOverride) return;
            continue;
          } else {
            if (chr == '[') seenBracket = true;
            else if (chr == ']') seenBracket = false;
            buffer += chr;
          } break;

        case PORT:
          if (exec(DIGIT, chr)) {
            buffer += chr;
          } else if (
            chr == EOF || chr == '/' || chr == '?' || chr == '#' ||
            (chr == '\\' && url.isSpecial()) ||
            stateOverride
          ) {
            if (buffer != '') {
              var port = parseInt(buffer, 10);
              if (port > 0xFFFF) return INVALID_PORT;
              url.port = (url.isSpecial() && port === specialSchemes[url.scheme]) ? null : port;
              buffer = '';
            }
            if (stateOverride) return;
            state = PATH_START;
            continue;
          } else return INVALID_PORT;
          break;

        case FILE:
          url.scheme = 'file';
          if (chr == '/' || chr == '\\') state = FILE_SLASH;
          else if (base && base.scheme == 'file') {
            if (chr == EOF) {
              url.host = base.host;
              url.path = arraySliceSimple(base.path);
              url.query = base.query;
            } else if (chr == '?') {
              url.host = base.host;
              url.path = arraySliceSimple(base.path);
              url.query = '';
              state = QUERY;
            } else if (chr == '#') {
              url.host = base.host;
              url.path = arraySliceSimple(base.path);
              url.query = base.query;
              url.fragment = '';
              state = FRAGMENT;
            } else {
              if (!startsWithWindowsDriveLetter(join(arraySliceSimple(codePoints, pointer), ''))) {
                url.host = base.host;
                url.path = arraySliceSimple(base.path);
                url.shortenPath();
              }
              state = PATH;
              continue;
            }
          } else {
            state = PATH;
            continue;
          } break;

        case FILE_SLASH:
          if (chr == '/' || chr == '\\') {
            state = FILE_HOST;
            break;
          }
          if (base && base.scheme == 'file' && !startsWithWindowsDriveLetter(join(arraySliceSimple(codePoints, pointer), ''))) {
            if (isWindowsDriveLetter(base.path[0], true)) push$2(url.path, base.path[0]);
            else url.host = base.host;
          }
          state = PATH;
          continue;

        case FILE_HOST:
          if (chr == EOF || chr == '/' || chr == '\\' || chr == '?' || chr == '#') {
            if (!stateOverride && isWindowsDriveLetter(buffer)) {
              state = PATH;
            } else if (buffer == '') {
              url.host = '';
              if (stateOverride) return;
              state = PATH_START;
            } else {
              failure = url.parseHost(buffer);
              if (failure) return failure;
              if (url.host == 'localhost') url.host = '';
              if (stateOverride) return;
              buffer = '';
              state = PATH_START;
            } continue;
          } else buffer += chr;
          break;

        case PATH_START:
          if (url.isSpecial()) {
            state = PATH;
            if (chr != '/' && chr != '\\') continue;
          } else if (!stateOverride && chr == '?') {
            url.query = '';
            state = QUERY;
          } else if (!stateOverride && chr == '#') {
            url.fragment = '';
            state = FRAGMENT;
          } else if (chr != EOF) {
            state = PATH;
            if (chr != '/') continue;
          } break;

        case PATH:
          if (
            chr == EOF || chr == '/' ||
            (chr == '\\' && url.isSpecial()) ||
            (!stateOverride && (chr == '?' || chr == '#'))
          ) {
            if (isDoubleDot(buffer)) {
              url.shortenPath();
              if (chr != '/' && !(chr == '\\' && url.isSpecial())) {
                push$2(url.path, '');
              }
            } else if (isSingleDot(buffer)) {
              if (chr != '/' && !(chr == '\\' && url.isSpecial())) {
                push$2(url.path, '');
              }
            } else {
              if (url.scheme == 'file' && !url.path.length && isWindowsDriveLetter(buffer)) {
                if (url.host) url.host = '';
                buffer = charAt$1(buffer, 0) + ':'; // normalize windows drive letter
              }
              push$2(url.path, buffer);
            }
            buffer = '';
            if (url.scheme == 'file' && (chr == EOF || chr == '?' || chr == '#')) {
              while (url.path.length > 1 && url.path[0] === '') {
                shift(url.path);
              }
            }
            if (chr == '?') {
              url.query = '';
              state = QUERY;
            } else if (chr == '#') {
              url.fragment = '';
              state = FRAGMENT;
            }
          } else {
            buffer += percentEncode(chr, pathPercentEncodeSet);
          } break;

        case CANNOT_BE_A_BASE_URL_PATH:
          if (chr == '?') {
            url.query = '';
            state = QUERY;
          } else if (chr == '#') {
            url.fragment = '';
            state = FRAGMENT;
          } else if (chr != EOF) {
            url.path[0] += percentEncode(chr, C0ControlPercentEncodeSet);
          } break;

        case QUERY:
          if (!stateOverride && chr == '#') {
            url.fragment = '';
            state = FRAGMENT;
          } else if (chr != EOF) {
            if (chr == "'" && url.isSpecial()) url.query += '%27';
            else if (chr == '#') url.query += '%23';
            else url.query += percentEncode(chr, C0ControlPercentEncodeSet);
          } break;

        case FRAGMENT:
          if (chr != EOF) url.fragment += percentEncode(chr, fragmentPercentEncodeSet);
          break;
      }

      pointer++;
    }
  },
  // https://url.spec.whatwg.org/#host-parsing
  parseHost: function (input) {
    var result, codePoints, index;
    if (charAt$1(input, 0) == '[') {
      if (charAt$1(input, input.length - 1) != ']') return INVALID_HOST;
      result = parseIPv6(stringSlice$3(input, 1, -1));
      if (!result) return INVALID_HOST;
      this.host = result;
    // opaque host
    } else if (!this.isSpecial()) {
      if (exec(FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT, input)) return INVALID_HOST;
      result = '';
      codePoints = arrayFrom(input);
      for (index = 0; index < codePoints.length; index++) {
        result += percentEncode(codePoints[index], C0ControlPercentEncodeSet);
      }
      this.host = result;
    } else {
      input = stringPunycodeToAscii(input);
      if (exec(FORBIDDEN_HOST_CODE_POINT, input)) return INVALID_HOST;
      result = parseIPv4(input);
      if (result === null) return INVALID_HOST;
      this.host = result;
    }
  },
  // https://url.spec.whatwg.org/#cannot-have-a-username-password-port
  cannotHaveUsernamePasswordPort: function () {
    return !this.host || this.cannotBeABaseURL || this.scheme == 'file';
  },
  // https://url.spec.whatwg.org/#include-credentials
  includesCredentials: function () {
    return this.username != '' || this.password != '';
  },
  // https://url.spec.whatwg.org/#is-special
  isSpecial: function () {
    return hasOwnProperty_1$1(specialSchemes, this.scheme);
  },
  // https://url.spec.whatwg.org/#shorten-a-urls-path
  shortenPath: function () {
    var path = this.path;
    var pathSize = path.length;
    if (pathSize && (this.scheme != 'file' || pathSize != 1 || !isWindowsDriveLetter(path[0], true))) {
      path.length--;
    }
  },
  // https://url.spec.whatwg.org/#concept-url-serializer
  serialize: function () {
    var url = this;
    var scheme = url.scheme;
    var username = url.username;
    var password = url.password;
    var host = url.host;
    var port = url.port;
    var path = url.path;
    var query = url.query;
    var fragment = url.fragment;
    var output = scheme + ':';
    if (host !== null) {
      output += '//';
      if (url.includesCredentials()) {
        output += username + (password ? ':' + password : '') + '@';
      }
      output += serializeHost(host);
      if (port !== null) output += ':' + port;
    } else if (scheme == 'file') output += '//';
    output += url.cannotBeABaseURL ? path[0] : path.length ? '/' + join(path, '/') : '';
    if (query !== null) output += '?' + query;
    if (fragment !== null) output += '#' + fragment;
    return output;
  },
  // https://url.spec.whatwg.org/#dom-url-href
  setHref: function (href) {
    var failure = this.parse(href);
    if (failure) throw TypeError$a(failure);
    this.searchParams.update();
  },
  // https://url.spec.whatwg.org/#dom-url-origin
  getOrigin: function () {
    var scheme = this.scheme;
    var port = this.port;
    if (scheme == 'blob') try {
      return new URLConstructor(scheme.path[0]).origin;
    } catch (error) {
      return 'null';
    }
    if (scheme == 'file' || !this.isSpecial()) return 'null';
    return scheme + '://' + serializeHost(this.host) + (port !== null ? ':' + port : '');
  },
  // https://url.spec.whatwg.org/#dom-url-protocol
  getProtocol: function () {
    return this.scheme + ':';
  },
  setProtocol: function (protocol) {
    this.parse(toString$2(protocol) + ':', SCHEME_START);
  },
  // https://url.spec.whatwg.org/#dom-url-username
  getUsername: function () {
    return this.username;
  },
  setUsername: function (username) {
    var codePoints = arrayFrom(toString$2(username));
    if (this.cannotHaveUsernamePasswordPort()) return;
    this.username = '';
    for (var i = 0; i < codePoints.length; i++) {
      this.username += percentEncode(codePoints[i], userinfoPercentEncodeSet);
    }
  },
  // https://url.spec.whatwg.org/#dom-url-password
  getPassword: function () {
    return this.password;
  },
  setPassword: function (password) {
    var codePoints = arrayFrom(toString$2(password));
    if (this.cannotHaveUsernamePasswordPort()) return;
    this.password = '';
    for (var i = 0; i < codePoints.length; i++) {
      this.password += percentEncode(codePoints[i], userinfoPercentEncodeSet);
    }
  },
  // https://url.spec.whatwg.org/#dom-url-host
  getHost: function () {
    var host = this.host;
    var port = this.port;
    return host === null ? ''
      : port === null ? serializeHost(host)
      : serializeHost(host) + ':' + port;
  },
  setHost: function (host) {
    if (this.cannotBeABaseURL) return;
    this.parse(host, HOST);
  },
  // https://url.spec.whatwg.org/#dom-url-hostname
  getHostname: function () {
    var host = this.host;
    return host === null ? '' : serializeHost(host);
  },
  setHostname: function (hostname) {
    if (this.cannotBeABaseURL) return;
    this.parse(hostname, HOSTNAME);
  },
  // https://url.spec.whatwg.org/#dom-url-port
  getPort: function () {
    var port = this.port;
    return port === null ? '' : toString$2(port);
  },
  setPort: function (port) {
    if (this.cannotHaveUsernamePasswordPort()) return;
    port = toString$2(port);
    if (port == '') this.port = null;
    else this.parse(port, PORT);
  },
  // https://url.spec.whatwg.org/#dom-url-pathname
  getPathname: function () {
    var path = this.path;
    return this.cannotBeABaseURL ? path[0] : path.length ? '/' + join(path, '/') : '';
  },
  setPathname: function (pathname) {
    if (this.cannotBeABaseURL) return;
    this.path = [];
    this.parse(pathname, PATH_START);
  },
  // https://url.spec.whatwg.org/#dom-url-search
  getSearch: function () {
    var query = this.query;
    return query ? '?' + query : '';
  },
  setSearch: function (search) {
    search = toString$2(search);
    if (search == '') {
      this.query = null;
    } else {
      if ('?' == charAt$1(search, 0)) search = stringSlice$3(search, 1);
      this.query = '';
      this.parse(search, QUERY);
    }
    this.searchParams.update();
  },
  // https://url.spec.whatwg.org/#dom-url-searchparams
  getSearchParams: function () {
    return this.searchParams.facade;
  },
  // https://url.spec.whatwg.org/#dom-url-hash
  getHash: function () {
    var fragment = this.fragment;
    return fragment ? '#' + fragment : '';
  },
  setHash: function (hash) {
    hash = toString$2(hash);
    if (hash == '') {
      this.fragment = null;
      return;
    }
    if ('#' == charAt$1(hash, 0)) hash = stringSlice$3(hash, 1);
    this.fragment = '';
    this.parse(hash, FRAGMENT);
  },
  update: function () {
    this.query = this.searchParams.serialize() || null;
  }
};

// `URL` constructor
// https://url.spec.whatwg.org/#url-class
var URLConstructor = function URL(url /* , base */) {
  var that = anInstance(this, URLPrototype);
  var base = arguments.length > 1 ? arguments[1] : undefined;
  var state = setInternalState$1(that, new URLState(url, false, base));
  if (!descriptors$1) {
    that.href = state.serialize();
    that.origin = state.getOrigin();
    that.protocol = state.getProtocol();
    that.username = state.getUsername();
    that.password = state.getPassword();
    that.host = state.getHost();
    that.hostname = state.getHostname();
    that.port = state.getPort();
    that.pathname = state.getPathname();
    that.search = state.getSearch();
    that.searchParams = state.getSearchParams();
    that.hash = state.getHash();
  }
};

var URLPrototype = URLConstructor.prototype;

var accessorDescriptor = function (getter, setter) {
  return {
    get: function () {
      return getInternalURLState(this)[getter]();
    },
    set: setter && function (value) {
      return getInternalURLState(this)[setter](value);
    },
    configurable: true,
    enumerable: true
  };
};

if (descriptors$1) {
  objectDefineProperties$1(URLPrototype, {
    // `URL.prototype.href` accessors pair
    // https://url.spec.whatwg.org/#dom-url-href
    href: accessorDescriptor('serialize', 'setHref'),
    // `URL.prototype.origin` getter
    // https://url.spec.whatwg.org/#dom-url-origin
    origin: accessorDescriptor('getOrigin'),
    // `URL.prototype.protocol` accessors pair
    // https://url.spec.whatwg.org/#dom-url-protocol
    protocol: accessorDescriptor('getProtocol', 'setProtocol'),
    // `URL.prototype.username` accessors pair
    // https://url.spec.whatwg.org/#dom-url-username
    username: accessorDescriptor('getUsername', 'setUsername'),
    // `URL.prototype.password` accessors pair
    // https://url.spec.whatwg.org/#dom-url-password
    password: accessorDescriptor('getPassword', 'setPassword'),
    // `URL.prototype.host` accessors pair
    // https://url.spec.whatwg.org/#dom-url-host
    host: accessorDescriptor('getHost', 'setHost'),
    // `URL.prototype.hostname` accessors pair
    // https://url.spec.whatwg.org/#dom-url-hostname
    hostname: accessorDescriptor('getHostname', 'setHostname'),
    // `URL.prototype.port` accessors pair
    // https://url.spec.whatwg.org/#dom-url-port
    port: accessorDescriptor('getPort', 'setPort'),
    // `URL.prototype.pathname` accessors pair
    // https://url.spec.whatwg.org/#dom-url-pathname
    pathname: accessorDescriptor('getPathname', 'setPathname'),
    // `URL.prototype.search` accessors pair
    // https://url.spec.whatwg.org/#dom-url-search
    search: accessorDescriptor('getSearch', 'setSearch'),
    // `URL.prototype.searchParams` getter
    // https://url.spec.whatwg.org/#dom-url-searchparams
    searchParams: accessorDescriptor('getSearchParams'),
    // `URL.prototype.hash` accessors pair
    // https://url.spec.whatwg.org/#dom-url-hash
    hash: accessorDescriptor('getHash', 'setHash')
  });
}

// `URL.prototype.toJSON` method
// https://url.spec.whatwg.org/#dom-url-tojson
redefine$1(URLPrototype, 'toJSON', function toJSON() {
  return getInternalURLState(this).serialize();
}, { enumerable: true });

// `URL.prototype.toString` method
// https://url.spec.whatwg.org/#URL-stringification-behavior
redefine$1(URLPrototype, 'toString', function toString() {
  return getInternalURLState(this).serialize();
}, { enumerable: true });

if (NativeURL) {
  var nativeCreateObjectURL = NativeURL.createObjectURL;
  var nativeRevokeObjectURL = NativeURL.revokeObjectURL;
  // `URL.createObjectURL` method
  // https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
  if (nativeCreateObjectURL) redefine$1(URLConstructor, 'createObjectURL', functionBindContext(nativeCreateObjectURL, NativeURL));
  // `URL.revokeObjectURL` method
  // https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
  if (nativeRevokeObjectURL) redefine$1(URLConstructor, 'revokeObjectURL', functionBindContext(nativeRevokeObjectURL, NativeURL));
}

setToStringTag$1(URLConstructor, 'URL');

_export$1({ global: true, forced: !nativeUrl, sham: !descriptors$1 }, {
  URL: URLConstructor
});

var url$3 = path$1.URL;

var url$2 = url$3;

var url$1 = url$2;

/*! js-cookie v3.0.1 | MIT */
/* eslint-disable no-var */
function assign (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      target[key] = source[key];
    }
  }
  return target
}
/* eslint-enable no-var */

/* eslint-disable no-var */
var defaultConverter = {
  read: function (value) {
    if (value[0] === '"') {
      value = value.slice(1, -1);
    }
    return value.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent)
  },
  write: function (value) {
    return encodeURIComponent(value).replace(
      /%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g,
      decodeURIComponent
    )
  }
};
/* eslint-enable no-var */

/* eslint-disable no-var */

function init$1 (converter, defaultAttributes) {
  function set (key, value, attributes) {
    if (typeof document === 'undefined') {
      return
    }

    attributes = assign({}, defaultAttributes, attributes);

    if (typeof attributes.expires === 'number') {
      attributes.expires = new Date(Date.now() + attributes.expires * 864e5);
    }
    if (attributes.expires) {
      attributes.expires = attributes.expires.toUTCString();
    }

    key = encodeURIComponent(key)
      .replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent)
      .replace(/[()]/g, escape);

    var stringifiedAttributes = '';
    for (var attributeName in attributes) {
      if (!attributes[attributeName]) {
        continue
      }

      stringifiedAttributes += '; ' + attributeName;

      if (attributes[attributeName] === true) {
        continue
      }

      // Considers RFC 6265 section 5.2:
      // ...
      // 3.  If the remaining unparsed-attributes contains a %x3B (";")
      //     character:
      // Consume the characters of the unparsed-attributes up to,
      // not including, the first %x3B (";") character.
      // ...
      stringifiedAttributes += '=' + attributes[attributeName].split(';')[0];
    }

    return (document.cookie =
      key + '=' + converter.write(value, key) + stringifiedAttributes)
  }

  function get (key) {
    if (typeof document === 'undefined' || (arguments.length && !key)) {
      return
    }

    // To prevent the for loop in the first place assign an empty array
    // in case there are no cookies at all.
    var cookies = document.cookie ? document.cookie.split('; ') : [];
    var jar = {};
    for (var i = 0; i < cookies.length; i++) {
      var parts = cookies[i].split('=');
      var value = parts.slice(1).join('=');

      try {
        var foundKey = decodeURIComponent(parts[0]);
        jar[foundKey] = converter.read(value, foundKey);

        if (key === foundKey) {
          break
        }
      } catch (e) {}
    }

    return key ? jar[key] : jar
  }

  return Object.create(
    {
      set: set,
      get: get,
      remove: function (key, attributes) {
        set(
          key,
          '',
          assign({}, attributes, {
            expires: -1
          })
        );
      },
      withAttributes: function (attributes) {
        return init$1(this.converter, assign({}, this.attributes, attributes))
      },
      withConverter: function (converter) {
        return init$1(assign({}, this.converter, converter), this.attributes)
      }
    },
    {
      attributes: { value: Object.freeze(defaultAttributes) },
      converter: { value: Object.freeze(converter) }
    }
  )
}

var api = init$1(defaultConverter, { path: '/' });

const prefix = 'mirage_'; // 添加 refer_url 到 sessionStorage 的 key

const rfKey = `${prefix}rfr`; // 添加 cookie_id 到 localStorage 的 key

const cidKey = `${prefix}cid`; // 添加 session_id 到 localStorage 的 key

const sidKey = `${prefix}sid`; // 添加 广告归因标识 到 cookie 的 key。关闭浏览器需要重新生成，故需要存放在 cookie

const utmKey = `${prefix}utm`; // 添加 广告系统埋点 到 cookie 的 key。关闭浏览器需要重新生成，故需要存放在 cookie

const adKey = `${prefix}ad`; // 添加 访问过的路径栈 到 sessionStorage 的 key

const attributionKey = `${prefix}attribution`; // 添加 访问过的路径栈 到 sessionStorage 的 key

const searchidKey = `${prefix}searchid`; // 添加 当前标签页的唯一ID 到 sessionStorage 的 key

const tabKey = `${prefix}tab`;
const getUserId = () => {
  var _userInfoObj$id;

  const userInfo = api.get('userInfo') || localStorage.getItem('userInfo') || '{}';
  const userInfoObj = JSON.parse(decodeURIComponent(userInfo)); // 用户ID。非必填，用户登录之后添加

  return (_userInfoObj$id = userInfoObj.id) != null ? _userInfoObj$id : '';
};

var check = function (it) {
  return it && it.Math == Math && it;
};

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global$1 =
  // eslint-disable-next-line es/no-global-this -- safe
  check(typeof globalThis == 'object' && globalThis) ||
  check(typeof window == 'object' && window) ||
  // eslint-disable-next-line no-restricted-globals -- safe
  check(typeof self == 'object' && self) ||
  check(typeof commonjsGlobal == 'object' && commonjsGlobal) ||
  // eslint-disable-next-line no-new-func -- fallback
  (function () { return this; })() || Function('return this')();

// iterable DOM collections
// flag - `iterable` interface - 'entries', 'keys', 'values', 'forEach' methods
var domIterables = {
  CSSRuleList: 0,
  CSSStyleDeclaration: 0,
  CSSValueList: 0,
  ClientRectList: 0,
  DOMRectList: 0,
  DOMStringList: 0,
  DOMTokenList: 1,
  DataTransferItemList: 0,
  FileList: 0,
  HTMLAllCollection: 0,
  HTMLCollection: 0,
  HTMLFormElement: 0,
  HTMLSelectElement: 0,
  MediaList: 0,
  MimeTypeArray: 0,
  NamedNodeMap: 0,
  NodeList: 1,
  PaintRequestList: 0,
  Plugin: 0,
  PluginArray: 0,
  SVGLengthList: 0,
  SVGNumberList: 0,
  SVGPathSegList: 0,
  SVGPointList: 0,
  SVGStringList: 0,
  SVGTransformList: 0,
  SourceBufferList: 0,
  StyleSheetList: 0,
  TextTrackCueList: 0,
  TextTrackList: 0,
  TouchList: 0
};

// `IsCallable` abstract operation
// https://tc39.es/ecma262/#sec-iscallable
var isCallable = function (argument) {
  return typeof argument == 'function';
};

var isObject = function (it) {
  return typeof it == 'object' ? it !== null : isCallable(it);
};

var document$1 = global$1.document;
// typeof document.createElement is 'object' in old IE
var EXISTS$1 = isObject(document$1) && isObject(document$1.createElement);

var documentCreateElement = function (it) {
  return EXISTS$1 ? document$1.createElement(it) : {};
};

// in old WebKit versions, `element.classList` is not an instance of global `DOMTokenList`


var classList = documentCreateElement('span').classList;
var DOMTokenListPrototype = classList && classList.constructor && classList.constructor.prototype;

var domTokenListPrototype = DOMTokenListPrototype === Object.prototype ? undefined : DOMTokenListPrototype;

var FunctionPrototype$1 = Function.prototype;
var bind = FunctionPrototype$1.bind;
var call$1 = FunctionPrototype$1.call;
var callBind = bind && bind.bind(call$1);

var functionUncurryThis = bind ? function (fn) {
  return fn && callBind(call$1, fn);
} : function (fn) {
  return fn && function () {
    return call$1.apply(fn, arguments);
  };
};

var fails = function (exec) {
  try {
    return !!exec();
  } catch (error) {
    return true;
  }
};

var toString$1 = functionUncurryThis({}.toString);
var stringSlice$2 = functionUncurryThis(''.slice);

var classofRaw = function (it) {
  return stringSlice$2(toString$1(it), 8, -1);
};

var Object$4 = global$1.Object;
var split = functionUncurryThis(''.split);

// fallback for non-array-like ES3 and non-enumerable old V8 strings
var indexedObject = fails(function () {
  // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
  // eslint-disable-next-line no-prototype-builtins -- safe
  return !Object$4('z').propertyIsEnumerable(0);
}) ? function (it) {
  return classofRaw(it) == 'String' ? split(it, '') : Object$4(it);
} : Object$4;

var TypeError$9 = global$1.TypeError;

// `RequireObjectCoercible` abstract operation
// https://tc39.es/ecma262/#sec-requireobjectcoercible
var requireObjectCoercible = function (it) {
  if (it == undefined) throw TypeError$9("Can't call method on " + it);
  return it;
};

// toObject with fallback for non-array-like ES3 strings



var toIndexedObject = function (it) {
  return indexedObject(requireObjectCoercible(it));
};

// eslint-disable-next-line es/no-object-defineproperty -- safe
var defineProperty$1 = Object.defineProperty;

var setGlobal = function (key, value) {
  try {
    defineProperty$1(global$1, key, { value: value, configurable: true, writable: true });
  } catch (error) {
    global$1[key] = value;
  } return value;
};

var SHARED = '__core-js_shared__';
var store$1 = global$1[SHARED] || setGlobal(SHARED, {});

var sharedStore = store$1;

var shared = createCommonjsModule(function (module) {
(module.exports = function (key, value) {
  return sharedStore[key] || (sharedStore[key] = value !== undefined ? value : {});
})('versions', []).push({
  version: '3.19.3',
  mode: 'global',
  copyright: '© 2021 Denis Pushkarev (zloirock.ru)'
});
});

var Object$3 = global$1.Object;

// `ToObject` abstract operation
// https://tc39.es/ecma262/#sec-toobject
var toObject = function (argument) {
  return Object$3(requireObjectCoercible(argument));
};

var hasOwnProperty = functionUncurryThis({}.hasOwnProperty);

// `HasOwnProperty` abstract operation
// https://tc39.es/ecma262/#sec-hasownproperty
var hasOwnProperty_1 = Object.hasOwn || function hasOwn(it, key) {
  return hasOwnProperty(toObject(it), key);
};

var id = 0;
var postfix = Math.random();
var toString = functionUncurryThis(1.0.toString);

var uid = function (key) {
  return 'Symbol(' + (key === undefined ? '' : key) + ')_' + toString(++id + postfix, 36);
};

var aFunction = function (argument) {
  return isCallable(argument) ? argument : undefined;
};

var getBuiltIn = function (namespace, method) {
  return arguments.length < 2 ? aFunction(global$1[namespace]) : global$1[namespace] && global$1[namespace][method];
};

var engineUserAgent = getBuiltIn('navigator', 'userAgent') || '';

var process = global$1.process;
var Deno = global$1.Deno;
var versions = process && process.versions || Deno && Deno.version;
var v8 = versions && versions.v8;
var match, version;

if (v8) {
  match = v8.split('.');
  // in old Chrome, versions of V8 isn't V8 = Chrome / 10
  // but their correct versions are not interesting for us
  version = match[0] > 0 && match[0] < 4 ? 1 : +(match[0] + match[1]);
}

// BrowserFS NodeJS `process` polyfill incorrectly set `.v8` to `0.0`
// so check `userAgent` even if `.v8` exists, but 0
if (!version && engineUserAgent) {
  match = engineUserAgent.match(/Edge\/(\d+)/);
  if (!match || match[1] >= 74) {
    match = engineUserAgent.match(/Chrome\/(\d+)/);
    if (match) version = +match[1];
  }
}

var engineV8Version = version;

/* eslint-disable es/no-symbol -- required for testing */

// eslint-disable-next-line es/no-object-getownpropertysymbols -- required for testing
var nativeSymbol = !!Object.getOwnPropertySymbols && !fails(function () {
  var symbol = Symbol();
  // Chrome 38 Symbol has incorrect toString conversion
  // `get-own-property-symbols` polyfill symbols converted to object are not Symbol instances
  return !String(symbol) || !(Object(symbol) instanceof Symbol) ||
    // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
    !Symbol.sham && engineV8Version && engineV8Version < 41;
});

/* eslint-disable es/no-symbol -- required for testing */

var useSymbolAsUid = nativeSymbol
  && !Symbol.sham
  && typeof Symbol.iterator == 'symbol';

var WellKnownSymbolsStore = shared('wks');
var Symbol$1 = global$1.Symbol;
var symbolFor = Symbol$1 && Symbol$1['for'];
var createWellKnownSymbol = useSymbolAsUid ? Symbol$1 : Symbol$1 && Symbol$1.withoutSetter || uid;

var wellKnownSymbol = function (name) {
  if (!hasOwnProperty_1(WellKnownSymbolsStore, name) || !(nativeSymbol || typeof WellKnownSymbolsStore[name] == 'string')) {
    var description = 'Symbol.' + name;
    if (nativeSymbol && hasOwnProperty_1(Symbol$1, name)) {
      WellKnownSymbolsStore[name] = Symbol$1[name];
    } else if (useSymbolAsUid && symbolFor) {
      WellKnownSymbolsStore[name] = symbolFor(description);
    } else {
      WellKnownSymbolsStore[name] = createWellKnownSymbol(description);
    }
  } return WellKnownSymbolsStore[name];
};

var String$3 = global$1.String;
var TypeError$8 = global$1.TypeError;

// `Assert: Type(argument) is Object`
var anObject = function (argument) {
  if (isObject(argument)) return argument;
  throw TypeError$8(String$3(argument) + ' is not an object');
};

// Detect IE8's incomplete defineProperty implementation
var descriptors = !fails(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- required for testing
  return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
});

// Thank's IE8 for his funny defineProperty
var ie8DomDefine = !descriptors && !fails(function () {
  // eslint-disable-next-line es/no-object-defineproperty -- requied for testing
  return Object.defineProperty(documentCreateElement('div'), 'a', {
    get: function () { return 7; }
  }).a != 7;
});

var call = Function.prototype.call;

var functionCall = call.bind ? call.bind(call) : function () {
  return call.apply(call, arguments);
};

var objectIsPrototypeOf = functionUncurryThis({}.isPrototypeOf);

var Object$2 = global$1.Object;

var isSymbol = useSymbolAsUid ? function (it) {
  return typeof it == 'symbol';
} : function (it) {
  var $Symbol = getBuiltIn('Symbol');
  return isCallable($Symbol) && objectIsPrototypeOf($Symbol.prototype, Object$2(it));
};

var String$2 = global$1.String;

var tryToString = function (argument) {
  try {
    return String$2(argument);
  } catch (error) {
    return 'Object';
  }
};

var TypeError$7 = global$1.TypeError;

// `Assert: IsCallable(argument) is true`
var aCallable = function (argument) {
  if (isCallable(argument)) return argument;
  throw TypeError$7(tryToString(argument) + ' is not a function');
};

// `GetMethod` abstract operation
// https://tc39.es/ecma262/#sec-getmethod
var getMethod = function (V, P) {
  var func = V[P];
  return func == null ? undefined : aCallable(func);
};

var TypeError$6 = global$1.TypeError;

// `OrdinaryToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-ordinarytoprimitive
var ordinaryToPrimitive = function (input, pref) {
  var fn, val;
  if (pref === 'string' && isCallable(fn = input.toString) && !isObject(val = functionCall(fn, input))) return val;
  if (isCallable(fn = input.valueOf) && !isObject(val = functionCall(fn, input))) return val;
  if (pref !== 'string' && isCallable(fn = input.toString) && !isObject(val = functionCall(fn, input))) return val;
  throw TypeError$6("Can't convert object to primitive value");
};

var TypeError$5 = global$1.TypeError;
var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');

// `ToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-toprimitive
var toPrimitive = function (input, pref) {
  if (!isObject(input) || isSymbol(input)) return input;
  var exoticToPrim = getMethod(input, TO_PRIMITIVE);
  var result;
  if (exoticToPrim) {
    if (pref === undefined) pref = 'default';
    result = functionCall(exoticToPrim, input, pref);
    if (!isObject(result) || isSymbol(result)) return result;
    throw TypeError$5("Can't convert object to primitive value");
  }
  if (pref === undefined) pref = 'number';
  return ordinaryToPrimitive(input, pref);
};

// `ToPropertyKey` abstract operation
// https://tc39.es/ecma262/#sec-topropertykey
var toPropertyKey = function (argument) {
  var key = toPrimitive(argument, 'string');
  return isSymbol(key) ? key : key + '';
};

var TypeError$4 = global$1.TypeError;
// eslint-disable-next-line es/no-object-defineproperty -- safe
var $defineProperty = Object.defineProperty;

// `Object.defineProperty` method
// https://tc39.es/ecma262/#sec-object.defineproperty
var f$4 = descriptors ? $defineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPropertyKey(P);
  anObject(Attributes);
  if (ie8DomDefine) try {
    return $defineProperty(O, P, Attributes);
  } catch (error) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError$4('Accessors not supported');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};

var objectDefineProperty = {
	f: f$4
};

var ceil = Math.ceil;
var floor$1 = Math.floor;

// `ToIntegerOrInfinity` abstract operation
// https://tc39.es/ecma262/#sec-tointegerorinfinity
var toIntegerOrInfinity = function (argument) {
  var number = +argument;
  // eslint-disable-next-line no-self-compare -- safe
  return number !== number || number === 0 ? 0 : (number > 0 ? floor$1 : ceil)(number);
};

var max$1 = Math.max;
var min$1 = Math.min;

// Helper for a popular repeating case of the spec:
// Let integer be ? ToInteger(index).
// If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
var toAbsoluteIndex = function (index, length) {
  var integer = toIntegerOrInfinity(index);
  return integer < 0 ? max$1(integer + length, 0) : min$1(integer, length);
};

var min = Math.min;

// `ToLength` abstract operation
// https://tc39.es/ecma262/#sec-tolength
var toLength = function (argument) {
  return argument > 0 ? min(toIntegerOrInfinity(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
};

// `LengthOfArrayLike` abstract operation
// https://tc39.es/ecma262/#sec-lengthofarraylike
var lengthOfArrayLike = function (obj) {
  return toLength(obj.length);
};

// `Array.prototype.{ indexOf, includes }` methods implementation
var createMethod = function (IS_INCLUDES) {
  return function ($this, el, fromIndex) {
    var O = toIndexedObject($this);
    var length = lengthOfArrayLike(O);
    var index = toAbsoluteIndex(fromIndex, length);
    var value;
    // Array#includes uses SameValueZero equality algorithm
    // eslint-disable-next-line no-self-compare -- NaN check
    if (IS_INCLUDES && el != el) while (length > index) {
      value = O[index++];
      // eslint-disable-next-line no-self-compare -- NaN check
      if (value != value) return true;
    // Array#indexOf ignores holes, Array#includes - not
    } else for (;length > index; index++) {
      if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};

var arrayIncludes = {
  // `Array.prototype.includes` method
  // https://tc39.es/ecma262/#sec-array.prototype.includes
  includes: createMethod(true),
  // `Array.prototype.indexOf` method
  // https://tc39.es/ecma262/#sec-array.prototype.indexof
  indexOf: createMethod(false)
};

var hiddenKeys$1 = {};

var indexOf$1 = arrayIncludes.indexOf;


var push$1 = functionUncurryThis([].push);

var objectKeysInternal = function (object, names) {
  var O = toIndexedObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) !hasOwnProperty_1(hiddenKeys$1, key) && hasOwnProperty_1(O, key) && push$1(result, key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (hasOwnProperty_1(O, key = names[i++])) {
    ~indexOf$1(result, key) || push$1(result, key);
  }
  return result;
};

// IE8- don't enum bug keys
var enumBugKeys = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf'
];

// `Object.keys` method
// https://tc39.es/ecma262/#sec-object.keys
// eslint-disable-next-line es/no-object-keys -- safe
var objectKeys = Object.keys || function keys(O) {
  return objectKeysInternal(O, enumBugKeys);
};

// `Object.defineProperties` method
// https://tc39.es/ecma262/#sec-object.defineproperties
// eslint-disable-next-line es/no-object-defineproperties -- safe
var objectDefineProperties = descriptors ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var props = toIndexedObject(Properties);
  var keys = objectKeys(Properties);
  var length = keys.length;
  var index = 0;
  var key;
  while (length > index) objectDefineProperty.f(O, key = keys[index++], props[key]);
  return O;
};

var html = getBuiltIn('document', 'documentElement');

var keys = shared('keys');

var sharedKey = function (key) {
  return keys[key] || (keys[key] = uid(key));
};

/* global ActiveXObject -- old IE, WSH */

var GT = '>';
var LT = '<';
var PROTOTYPE = 'prototype';
var SCRIPT = 'script';
var IE_PROTO$1 = sharedKey('IE_PROTO');

var EmptyConstructor = function () { /* empty */ };

var scriptTag = function (content) {
  return LT + SCRIPT + GT + content + LT + '/' + SCRIPT + GT;
};

// Create object with fake `null` prototype: use ActiveX Object with cleared prototype
var NullProtoObjectViaActiveX = function (activeXDocument) {
  activeXDocument.write(scriptTag(''));
  activeXDocument.close();
  var temp = activeXDocument.parentWindow.Object;
  activeXDocument = null; // avoid memory leak
  return temp;
};

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var NullProtoObjectViaIFrame = function () {
  // Thrash, waste and sodomy: IE GC bug
  var iframe = documentCreateElement('iframe');
  var JS = 'java' + SCRIPT + ':';
  var iframeDocument;
  iframe.style.display = 'none';
  html.appendChild(iframe);
  // https://github.com/zloirock/core-js/issues/475
  iframe.src = String(JS);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(scriptTag('document.F=Object'));
  iframeDocument.close();
  return iframeDocument.F;
};

// Check for document.domain and active x support
// No need to use active x approach when document.domain is not set
// see https://github.com/es-shims/es5-shim/issues/150
// variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
// avoid IE GC bug
var activeXDocument;
var NullProtoObject = function () {
  try {
    activeXDocument = new ActiveXObject('htmlfile');
  } catch (error) { /* ignore */ }
  NullProtoObject = typeof document != 'undefined'
    ? document.domain && activeXDocument
      ? NullProtoObjectViaActiveX(activeXDocument) // old IE
      : NullProtoObjectViaIFrame()
    : NullProtoObjectViaActiveX(activeXDocument); // WSH
  var length = enumBugKeys.length;
  while (length--) delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
  return NullProtoObject();
};

hiddenKeys$1[IE_PROTO$1] = true;

// `Object.create` method
// https://tc39.es/ecma262/#sec-object.create
var objectCreate = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    EmptyConstructor[PROTOTYPE] = anObject(O);
    result = new EmptyConstructor();
    EmptyConstructor[PROTOTYPE] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO$1] = O;
  } else result = NullProtoObject();
  return Properties === undefined ? result : objectDefineProperties(result, Properties);
};

var UNSCOPABLES = wellKnownSymbol('unscopables');
var ArrayPrototype = Array.prototype;

// Array.prototype[@@unscopables]
// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
if (ArrayPrototype[UNSCOPABLES] == undefined) {
  objectDefineProperty.f(ArrayPrototype, UNSCOPABLES, {
    configurable: true,
    value: objectCreate(null)
  });
}

// add a key to Array.prototype[@@unscopables]
var addToUnscopables = function (key) {
  ArrayPrototype[UNSCOPABLES][key] = true;
};

var iterators = {};

var functionToString = functionUncurryThis(Function.toString);

// this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
if (!isCallable(sharedStore.inspectSource)) {
  sharedStore.inspectSource = function (it) {
    return functionToString(it);
  };
}

var inspectSource = sharedStore.inspectSource;

var WeakMap$2 = global$1.WeakMap;

var nativeWeakMap = isCallable(WeakMap$2) && /native code/.test(inspectSource(WeakMap$2));

var createPropertyDescriptor = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};

var createNonEnumerableProperty = descriptors ? function (object, key, value) {
  return objectDefineProperty.f(object, key, createPropertyDescriptor(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};

var OBJECT_ALREADY_INITIALIZED = 'Object already initialized';
var TypeError$3 = global$1.TypeError;
var WeakMap$1 = global$1.WeakMap;
var set, get, has;

var enforce = function (it) {
  return has(it) ? get(it) : set(it, {});
};

var getterFor = function (TYPE) {
  return function (it) {
    var state;
    if (!isObject(it) || (state = get(it)).type !== TYPE) {
      throw TypeError$3('Incompatible receiver, ' + TYPE + ' required');
    } return state;
  };
};

if (nativeWeakMap || sharedStore.state) {
  var store = sharedStore.state || (sharedStore.state = new WeakMap$1());
  var wmget = functionUncurryThis(store.get);
  var wmhas = functionUncurryThis(store.has);
  var wmset = functionUncurryThis(store.set);
  set = function (it, metadata) {
    if (wmhas(store, it)) throw new TypeError$3(OBJECT_ALREADY_INITIALIZED);
    metadata.facade = it;
    wmset(store, it, metadata);
    return metadata;
  };
  get = function (it) {
    return wmget(store, it) || {};
  };
  has = function (it) {
    return wmhas(store, it);
  };
} else {
  var STATE = sharedKey('state');
  hiddenKeys$1[STATE] = true;
  set = function (it, metadata) {
    if (hasOwnProperty_1(it, STATE)) throw new TypeError$3(OBJECT_ALREADY_INITIALIZED);
    metadata.facade = it;
    createNonEnumerableProperty(it, STATE, metadata);
    return metadata;
  };
  get = function (it) {
    return hasOwnProperty_1(it, STATE) ? it[STATE] : {};
  };
  has = function (it) {
    return hasOwnProperty_1(it, STATE);
  };
}

var internalState = {
  set: set,
  get: get,
  has: has,
  enforce: enforce,
  getterFor: getterFor
};

var $propertyIsEnumerable = {}.propertyIsEnumerable;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getOwnPropertyDescriptor$1 = Object.getOwnPropertyDescriptor;

// Nashorn ~ JDK8 bug
var NASHORN_BUG = getOwnPropertyDescriptor$1 && !$propertyIsEnumerable.call({ 1: 2 }, 1);

// `Object.prototype.propertyIsEnumerable` method implementation
// https://tc39.es/ecma262/#sec-object.prototype.propertyisenumerable
var f$3 = NASHORN_BUG ? function propertyIsEnumerable(V) {
  var descriptor = getOwnPropertyDescriptor$1(this, V);
  return !!descriptor && descriptor.enumerable;
} : $propertyIsEnumerable;

var objectPropertyIsEnumerable = {
	f: f$3
};

// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

// `Object.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
var f$2 = descriptors ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
  O = toIndexedObject(O);
  P = toPropertyKey(P);
  if (ie8DomDefine) try {
    return $getOwnPropertyDescriptor(O, P);
  } catch (error) { /* empty */ }
  if (hasOwnProperty_1(O, P)) return createPropertyDescriptor(!functionCall(objectPropertyIsEnumerable.f, O, P), O[P]);
};

var objectGetOwnPropertyDescriptor = {
	f: f$2
};

var FunctionPrototype = Function.prototype;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getDescriptor = descriptors && Object.getOwnPropertyDescriptor;

var EXISTS = hasOwnProperty_1(FunctionPrototype, 'name');
// additional protection from minified / mangled / dropped function names
var PROPER = EXISTS && (function something() { /* empty */ }).name === 'something';
var CONFIGURABLE = EXISTS && (!descriptors || (descriptors && getDescriptor(FunctionPrototype, 'name').configurable));

var functionName = {
  EXISTS: EXISTS,
  PROPER: PROPER,
  CONFIGURABLE: CONFIGURABLE
};

var redefine = createCommonjsModule(function (module) {
var CONFIGURABLE_FUNCTION_NAME = functionName.CONFIGURABLE;

var getInternalState = internalState.get;
var enforceInternalState = internalState.enforce;
var TEMPLATE = String(String).split('String');

(module.exports = function (O, key, value, options) {
  var unsafe = options ? !!options.unsafe : false;
  var simple = options ? !!options.enumerable : false;
  var noTargetGet = options ? !!options.noTargetGet : false;
  var name = options && options.name !== undefined ? options.name : key;
  var state;
  if (isCallable(value)) {
    if (String(name).slice(0, 7) === 'Symbol(') {
      name = '[' + String(name).replace(/^Symbol\(([^)]*)\)/, '$1') + ']';
    }
    if (!hasOwnProperty_1(value, 'name') || (CONFIGURABLE_FUNCTION_NAME && value.name !== name)) {
      createNonEnumerableProperty(value, 'name', name);
    }
    state = enforceInternalState(value);
    if (!state.source) {
      state.source = TEMPLATE.join(typeof name == 'string' ? name : '');
    }
  }
  if (O === global$1) {
    if (simple) O[key] = value;
    else setGlobal(key, value);
    return;
  } else if (!unsafe) {
    delete O[key];
  } else if (!noTargetGet && O[key]) {
    simple = true;
  }
  if (simple) O[key] = value;
  else createNonEnumerableProperty(O, key, value);
// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
})(Function.prototype, 'toString', function toString() {
  return isCallable(this) && getInternalState(this).source || inspectSource(this);
});
});

var hiddenKeys = enumBugKeys.concat('length', 'prototype');

// `Object.getOwnPropertyNames` method
// https://tc39.es/ecma262/#sec-object.getownpropertynames
// eslint-disable-next-line es/no-object-getownpropertynames -- safe
var f$1 = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return objectKeysInternal(O, hiddenKeys);
};

var objectGetOwnPropertyNames = {
	f: f$1
};

// eslint-disable-next-line es/no-object-getownpropertysymbols -- safe
var f = Object.getOwnPropertySymbols;

var objectGetOwnPropertySymbols = {
	f: f
};

var concat = functionUncurryThis([].concat);

// all object keys, includes non-enumerable and symbols
var ownKeys = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
  var keys = objectGetOwnPropertyNames.f(anObject(it));
  var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
  return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
};

var copyConstructorProperties = function (target, source) {
  var keys = ownKeys(source);
  var defineProperty = objectDefineProperty.f;
  var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!hasOwnProperty_1(target, key)) defineProperty(target, key, getOwnPropertyDescriptor(source, key));
  }
};

var replacement = /#|\.prototype\./;

var isForced = function (feature, detection) {
  var value = data[normalize(feature)];
  return value == POLYFILL ? true
    : value == NATIVE ? false
    : isCallable(detection) ? fails(detection)
    : !!detection;
};

var normalize = isForced.normalize = function (string) {
  return String(string).replace(replacement, '.').toLowerCase();
};

var data = isForced.data = {};
var NATIVE = isForced.NATIVE = 'N';
var POLYFILL = isForced.POLYFILL = 'P';

var isForced_1 = isForced;

var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;






/*
  options.target      - name of the target object
  options.global      - target is the global object
  options.stat        - export as static methods of target
  options.proto       - export as prototype methods of target
  options.real        - real prototype method for the `pure` version
  options.forced      - export even if the native feature is available
  options.bind        - bind methods to the target, required for the `pure` version
  options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
  options.unsafe      - use the simple assignment of property instead of delete + defineProperty
  options.sham        - add a flag to not completely full polyfills
  options.enumerable  - export as enumerable property
  options.noTargetGet - prevent calling a getter on target
  options.name        - the .name of the function if it does not match the key
*/
var _export = function (options, source) {
  var TARGET = options.target;
  var GLOBAL = options.global;
  var STATIC = options.stat;
  var FORCED, target, key, targetProperty, sourceProperty, descriptor;
  if (GLOBAL) {
    target = global$1;
  } else if (STATIC) {
    target = global$1[TARGET] || setGlobal(TARGET, {});
  } else {
    target = (global$1[TARGET] || {}).prototype;
  }
  if (target) for (key in source) {
    sourceProperty = source[key];
    if (options.noTargetGet) {
      descriptor = getOwnPropertyDescriptor(target, key);
      targetProperty = descriptor && descriptor.value;
    } else targetProperty = target[key];
    FORCED = isForced_1(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
    // contained in target
    if (!FORCED && targetProperty !== undefined) {
      if (typeof sourceProperty == typeof targetProperty) continue;
      copyConstructorProperties(sourceProperty, targetProperty);
    }
    // add a flag to not completely full polyfills
    if (options.sham || (targetProperty && targetProperty.sham)) {
      createNonEnumerableProperty(sourceProperty, 'sham', true);
    }
    // extend global
    redefine(target, key, sourceProperty, options);
  }
};

var correctPrototypeGetter = !fails(function () {
  function F() { /* empty */ }
  F.prototype.constructor = null;
  // eslint-disable-next-line es/no-object-getprototypeof -- required for testing
  return Object.getPrototypeOf(new F()) !== F.prototype;
});

var IE_PROTO = sharedKey('IE_PROTO');
var Object$1 = global$1.Object;
var ObjectPrototype = Object$1.prototype;

// `Object.getPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.getprototypeof
var objectGetPrototypeOf = correctPrototypeGetter ? Object$1.getPrototypeOf : function (O) {
  var object = toObject(O);
  if (hasOwnProperty_1(object, IE_PROTO)) return object[IE_PROTO];
  var constructor = object.constructor;
  if (isCallable(constructor) && object instanceof constructor) {
    return constructor.prototype;
  } return object instanceof Object$1 ? ObjectPrototype : null;
};

var ITERATOR$2 = wellKnownSymbol('iterator');
var BUGGY_SAFARI_ITERATORS$1 = false;

// `%IteratorPrototype%` object
// https://tc39.es/ecma262/#sec-%iteratorprototype%-object
var IteratorPrototype$2, PrototypeOfArrayIteratorPrototype, arrayIterator;

/* eslint-disable es/no-array-prototype-keys -- safe */
if ([].keys) {
  arrayIterator = [].keys();
  // Safari 8 has buggy iterators w/o `next`
  if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS$1 = true;
  else {
    PrototypeOfArrayIteratorPrototype = objectGetPrototypeOf(objectGetPrototypeOf(arrayIterator));
    if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype$2 = PrototypeOfArrayIteratorPrototype;
  }
}

var NEW_ITERATOR_PROTOTYPE = IteratorPrototype$2 == undefined || fails(function () {
  var test = {};
  // FF44- legacy iterators case
  return IteratorPrototype$2[ITERATOR$2].call(test) !== test;
});

if (NEW_ITERATOR_PROTOTYPE) IteratorPrototype$2 = {};

// `%IteratorPrototype%[@@iterator]()` method
// https://tc39.es/ecma262/#sec-%iteratorprototype%-@@iterator
if (!isCallable(IteratorPrototype$2[ITERATOR$2])) {
  redefine(IteratorPrototype$2, ITERATOR$2, function () {
    return this;
  });
}

var iteratorsCore = {
  IteratorPrototype: IteratorPrototype$2,
  BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS$1
};

var defineProperty = objectDefineProperty.f;



var TO_STRING_TAG$1 = wellKnownSymbol('toStringTag');

var setToStringTag = function (it, TAG, STATIC) {
  if (it && !hasOwnProperty_1(it = STATIC ? it : it.prototype, TO_STRING_TAG$1)) {
    defineProperty(it, TO_STRING_TAG$1, { configurable: true, value: TAG });
  }
};

var IteratorPrototype$1 = iteratorsCore.IteratorPrototype;





var returnThis$1 = function () { return this; };

var createIteratorConstructor = function (IteratorConstructor, NAME, next, ENUMERABLE_NEXT) {
  var TO_STRING_TAG = NAME + ' Iterator';
  IteratorConstructor.prototype = objectCreate(IteratorPrototype$1, { next: createPropertyDescriptor(+!ENUMERABLE_NEXT, next) });
  setToStringTag(IteratorConstructor, TO_STRING_TAG, false);
  iterators[TO_STRING_TAG] = returnThis$1;
  return IteratorConstructor;
};

var String$1 = global$1.String;
var TypeError$2 = global$1.TypeError;

var aPossiblePrototype = function (argument) {
  if (typeof argument == 'object' || isCallable(argument)) return argument;
  throw TypeError$2("Can't set " + String$1(argument) + ' as a prototype');
};

/* eslint-disable no-proto -- safe */

// `Object.setPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.setprototypeof
// Works with __proto__ only. Old v8 can't work with null proto objects.
// eslint-disable-next-line es/no-object-setprototypeof -- safe
var objectSetPrototypeOf = Object.setPrototypeOf || ('__proto__' in {} ? function () {
  var CORRECT_SETTER = false;
  var test = {};
  var setter;
  try {
    // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
    setter = functionUncurryThis(Object.getOwnPropertyDescriptor(Object.prototype, '__proto__').set);
    setter(test, []);
    CORRECT_SETTER = test instanceof Array;
  } catch (error) { /* empty */ }
  return function setPrototypeOf(O, proto) {
    anObject(O);
    aPossiblePrototype(proto);
    if (CORRECT_SETTER) setter(O, proto);
    else O.__proto__ = proto;
    return O;
  };
}() : undefined);

var PROPER_FUNCTION_NAME = functionName.PROPER;
var CONFIGURABLE_FUNCTION_NAME = functionName.CONFIGURABLE;
var IteratorPrototype = iteratorsCore.IteratorPrototype;
var BUGGY_SAFARI_ITERATORS = iteratorsCore.BUGGY_SAFARI_ITERATORS;
var ITERATOR$1 = wellKnownSymbol('iterator');
var KEYS = 'keys';
var VALUES = 'values';
var ENTRIES = 'entries';

var returnThis = function () { return this; };

var defineIterator = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
  createIteratorConstructor(IteratorConstructor, NAME, next);

  var getIterationMethod = function (KIND) {
    if (KIND === DEFAULT && defaultIterator) return defaultIterator;
    if (!BUGGY_SAFARI_ITERATORS && KIND in IterablePrototype) return IterablePrototype[KIND];
    switch (KIND) {
      case KEYS: return function keys() { return new IteratorConstructor(this, KIND); };
      case VALUES: return function values() { return new IteratorConstructor(this, KIND); };
      case ENTRIES: return function entries() { return new IteratorConstructor(this, KIND); };
    } return function () { return new IteratorConstructor(this); };
  };

  var TO_STRING_TAG = NAME + ' Iterator';
  var INCORRECT_VALUES_NAME = false;
  var IterablePrototype = Iterable.prototype;
  var nativeIterator = IterablePrototype[ITERATOR$1]
    || IterablePrototype['@@iterator']
    || DEFAULT && IterablePrototype[DEFAULT];
  var defaultIterator = !BUGGY_SAFARI_ITERATORS && nativeIterator || getIterationMethod(DEFAULT);
  var anyNativeIterator = NAME == 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
  var CurrentIteratorPrototype, methods, KEY;

  // fix native
  if (anyNativeIterator) {
    CurrentIteratorPrototype = objectGetPrototypeOf(anyNativeIterator.call(new Iterable()));
    if (CurrentIteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
      if (objectGetPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype) {
        if (objectSetPrototypeOf) {
          objectSetPrototypeOf(CurrentIteratorPrototype, IteratorPrototype);
        } else if (!isCallable(CurrentIteratorPrototype[ITERATOR$1])) {
          redefine(CurrentIteratorPrototype, ITERATOR$1, returnThis);
        }
      }
      // Set @@toStringTag to native iterators
      setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true);
    }
  }

  // fix Array.prototype.{ values, @@iterator }.name in V8 / FF
  if (PROPER_FUNCTION_NAME && DEFAULT == VALUES && nativeIterator && nativeIterator.name !== VALUES) {
    if (CONFIGURABLE_FUNCTION_NAME) {
      createNonEnumerableProperty(IterablePrototype, 'name', VALUES);
    } else {
      INCORRECT_VALUES_NAME = true;
      defaultIterator = function values() { return functionCall(nativeIterator, this); };
    }
  }

  // export additional methods
  if (DEFAULT) {
    methods = {
      values: getIterationMethod(VALUES),
      keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
      entries: getIterationMethod(ENTRIES)
    };
    if (FORCED) for (KEY in methods) {
      if (BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
        redefine(IterablePrototype, KEY, methods[KEY]);
      }
    } else _export({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME }, methods);
  }

  // define iterator
  if (IterablePrototype[ITERATOR$1] !== defaultIterator) {
    redefine(IterablePrototype, ITERATOR$1, defaultIterator, { name: DEFAULT });
  }
  iterators[NAME] = defaultIterator;

  return methods;
};

var ARRAY_ITERATOR = 'Array Iterator';
var setInternalState = internalState.set;
var getInternalState = internalState.getterFor(ARRAY_ITERATOR);

// `Array.prototype.entries` method
// https://tc39.es/ecma262/#sec-array.prototype.entries
// `Array.prototype.keys` method
// https://tc39.es/ecma262/#sec-array.prototype.keys
// `Array.prototype.values` method
// https://tc39.es/ecma262/#sec-array.prototype.values
// `Array.prototype[@@iterator]` method
// https://tc39.es/ecma262/#sec-array.prototype-@@iterator
// `CreateArrayIterator` internal method
// https://tc39.es/ecma262/#sec-createarrayiterator
var es_array_iterator = defineIterator(Array, 'Array', function (iterated, kind) {
  setInternalState(this, {
    type: ARRAY_ITERATOR,
    target: toIndexedObject(iterated), // target
    index: 0,                          // next index
    kind: kind                         // kind
  });
// `%ArrayIteratorPrototype%.next` method
// https://tc39.es/ecma262/#sec-%arrayiteratorprototype%.next
}, function () {
  var state = getInternalState(this);
  var target = state.target;
  var kind = state.kind;
  var index = state.index++;
  if (!target || index >= target.length) {
    state.target = undefined;
    return { value: undefined, done: true };
  }
  if (kind == 'keys') return { value: index, done: false };
  if (kind == 'values') return { value: target[index], done: false };
  return { value: [index, target[index]], done: false };
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values%
// https://tc39.es/ecma262/#sec-createunmappedargumentsobject
// https://tc39.es/ecma262/#sec-createmappedargumentsobject
iterators.Arguments = iterators.Array;

// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('keys');
addToUnscopables('values');
addToUnscopables('entries');

var ITERATOR = wellKnownSymbol('iterator');
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var ArrayValues = es_array_iterator.values;

var handlePrototype = function (CollectionPrototype, COLLECTION_NAME) {
  if (CollectionPrototype) {
    // some Chrome versions have non-configurable methods on DOMTokenList
    if (CollectionPrototype[ITERATOR] !== ArrayValues) try {
      createNonEnumerableProperty(CollectionPrototype, ITERATOR, ArrayValues);
    } catch (error) {
      CollectionPrototype[ITERATOR] = ArrayValues;
    }
    if (!CollectionPrototype[TO_STRING_TAG]) {
      createNonEnumerableProperty(CollectionPrototype, TO_STRING_TAG, COLLECTION_NAME);
    }
    if (domIterables[COLLECTION_NAME]) for (var METHOD_NAME in es_array_iterator) {
      // some Chrome versions have non-configurable methods on DOMTokenList
      if (CollectionPrototype[METHOD_NAME] !== es_array_iterator[METHOD_NAME]) try {
        createNonEnumerableProperty(CollectionPrototype, METHOD_NAME, es_array_iterator[METHOD_NAME]);
      } catch (error) {
        CollectionPrototype[METHOD_NAME] = es_array_iterator[METHOD_NAME];
      }
    }
  }
};

for (var COLLECTION_NAME in domIterables) {
  handlePrototype(global$1[COLLECTION_NAME] && global$1[COLLECTION_NAME].prototype, COLLECTION_NAME);
}

handlePrototype(domTokenListPrototype, 'DOMTokenList');

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));
const getSetting = () => {
  var _window$__NEXT_DATA__, _window$__NEXT_DATA__2, _window$__NEXT_DATA__3;

  return ((_window$__NEXT_DATA__ = window.__NEXT_DATA__) == null ? void 0 : (_window$__NEXT_DATA__2 = _window$__NEXT_DATA__.props) == null ? void 0 : (_window$__NEXT_DATA__3 = _window$__NEXT_DATA__2.initialState) == null ? void 0 : _window$__NEXT_DATA__3.webSetting) || window.setting;
}; // process.env.NODE_ENV !== 'production' ||
// process.env.MODE === 'test'

const isPreview = location.search.includes('test_preview=');
const isTest = ['localhost', '127.0.0.1', '.alpha.stylewe.com', 'harbor.test', 'piepoch.com', 'cmall-front-alpha.'].some(item => window.location.hostname.includes(item)) || isPreview;

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const traces = []; // 0-9  48-57

for (let i = 48; i <= 57; i++) {
  traces.push(String.fromCharCode(i));
} // a-z  97-122


for (let i = 97; i <= 122; i++) {
  traces.push(String.fromCharCode(i));
} // A-Z  65-90


for (let i = 65; i <= 90; i++) {
  traces.push(String.fromCharCode(i));
}

const getTraceId = () => {
  let result = '';

  for (let i = 0; i < 32; i++) {
    const randomInt = getRandomInt(0, traces.length);
    result += traces[randomInt];
  }

  return result;
};
const getPathName = _url => {
  const url = _url.split('#')[0];

  const start = location.origin.length;
  const end = url.includes('?') ? url.indexOf('?') : url.length;
  return url.slice(start, end);
};
const isMatchPath = (pathRule, pathname) => {
  // 对路径进行处理
  const nextPathname = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  if (pathRule === nextPathname) {
    return true;
  }

  const pathRules = pathRule.split('/');
  const pathnames = nextPathname.split('/');

  if (pathRules.length !== pathnames.length) {
    return false;
  }

  return pathRules.every((item, index) => {
    return item.startsWith(':') || item === pathnames[index];
  });
}; // 自动添加 click_、impression_ 前缀

const composeEventId = (event_id, event_type) => {
  let nextEventId = event_id;

  if (nextEventId) {
    // 作为操作结果事件，不需要添加前缀
    if (nextEventId.endsWith('_result')) {
      return nextEventId;
    } // 作为滑动事件，已经存在前缀


    if (nextEventId.startsWith('slide_')) {
      return nextEventId;
    } // 作为触发事件，已经存在前缀


    if (nextEventId.startsWith('triger_')) {
      return nextEventId;
    }

    if (event_type === 'behavior') {
      nextEventId = `click_${nextEventId}`;
    } else if (event_type === 'impression') {
      nextEventId = `impression_${nextEventId}`;
    }
  }

  return nextEventId;
}; // 由运维提供，在nginx判断怎么走项目

const isMobileRegex = new RegExp('(iPhone|Android|iphone| Android 9 |Android 10|Android 11|iPhone OS|Mobile)', 'i');
const sizes = {
  tablet: 641,
  minWidth1000: 1000,
  desktop: 1241,
  minWidth1441: 1441
};
const getAppType = () => {
  const isInApp = !!window.flutter_inappwebview;

  if (isInApp) {
    var _Cookies$get, _Cookies$get2;

    const isInAndroidApp = (_Cookies$get = api.get('platform_appVersion')) == null ? void 0 : _Cookies$get.includes('android');
    const isInIosApp = (_Cookies$get2 = api.get('platform_appVersion')) == null ? void 0 : _Cookies$get2.includes('ios');

    if (isInAndroidApp) {
      return 'app_android';
    } else if (isInIosApp) {
      return 'app_ios';
    } else {
      return 'app';
    }
  } else {
    if (isMobileRegex.test(navigator.userAgent)) {
      // 从运维的M端分流中区分M端和ipad端
      if (window.matchMedia(`(min-width: ${sizes.tablet}px)`).matches) {
        return 'web_tablet';
      }

      return 'web_mobile';
    }

    return 'web_pc';
  }
};
const log = message => {
  console.error('-----------自埋点报错-----------', message);
}; // 将查询参数字符串转换为对象

const composeSearchObject = search => {
  const nextSearch = search.slice(search.startsWith('?') ? 1 : 0);

  if (!nextSearch.length) {
    return {};
  }

  const searchArr = nextSearch.split('&');
  return searchArr.reduce((previousValue, currentValue) => {
    const nextValue = { ...previousValue
    };
    const [key, value = ''] = currentValue.split('=');
    nextValue[key] = value;
    return nextValue;
  }, {});
};

let hasInitAd = false; // 兼容阻止 cookie 的情况

let adValue;

const saveData$1 = data => {
  adValue = data;
  api.set(adKey, JSON.stringify(data));
};

const removeData$1 = () => {
  adValue = null;
  api.remove(adKey);
};

const getData$1 = () => {
  return adValue || JSON.parse(api.get(adKey) || '{}');
};

const setAd = () => {
  try {
    const {
      search
    } = window.location;
    const searchParams = composeSearchObject(search);

    if (searchParams.ad_id || searchParams.creative) {
      const currentTime = Date.now();
      saveData$1({
        searchParams,
        visitedTime: currentTime
      });
    } else if (!hasInitAd && isFirstIn()) {
      // 手动输入 URL 进入网站，生成新 session
      removeData$1();
    } // 防止单页面应用重复执行


    hasInitAd = true;
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};
const getAd = () => {
  try {
    const utm = getData$1();

    if (!utm.visitedTime) {
      return {};
    }

    const currentTime = Date.now();
    const in30m = 30 * 60 * 1000;

    if (currentTime - utm.visitedTime > in30m) {
      removeData$1();
      return {};
    }

    return utm.searchParams || {};
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
    return {};
  }
};

let hasInitUtm = false; // 兼容阻止 cookie 的情况

let utmValue;

const saveData = data => {
  utmValue = data;
  api.set(utmKey, JSON.stringify(data));
};

const removeData = () => {
  utmValue = null;
  api.remove(utmKey);
};

const getData = () => {
  return utmValue || JSON.parse(api.get(utmKey) || '{}');
};

const setUtm = () => {
  try {
    const {
      search
    } = window.location;
    const searchParams = composeSearchObject(search);

    if (searchParams.utm_source || searchParams.utm_code || searchParams.creative) {
      const currentTime = Date.now();
      saveData({
        searchParams,
        visitedTime: currentTime
      });
    } else if (!hasInitUtm && isFirstIn()) {
      // 手动输入 URL 进入网站，生成新 session
      removeData();
    } // 防止单页面应用重复执行


    hasInitUtm = true;
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};
const getUtm = () => {
  try {
    const utm = getData();

    if (!utm.visitedTime) {
      return {};
    }

    const currentTime = Date.now();
    const in30m = 30 * 60 * 1000;

    if (currentTime - utm.visitedTime > in30m) {
      removeData();
      return {};
    }

    return utm.searchParams || {};
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
    return {};
  }
};

const historyStack = {
  prev: '',
  current: ''
};

const isDiffUrl = url => {
  const currentHref = historyStack.current;
  return currentHref !== url;
};

if (!sessionStorage.getItem(tabKey)) {
  sessionStorage.setItem(tabKey, `${new Date().toISOString()}@${String(Math.random()).slice(2, 6)}`);
}
/**
 * 获取完整的 URL
 *
 * @param url {string}  路径或完整的 URL，如 /a 或者 http://localhost/a
 * @returns {string}
 */


const getHref = url => {
  const urlObj = new url$1(url, window.location.href);
  return urlObj.href;
};

const NAVIGATION_TYPE = {
  0: 'navigate',
  1: 'reload',
  2: 'back_forward',
  255: 'reserved'
};
const navigationPerformance = performance.getEntriesByType('navigation')[0]; // 处理兼容性问题

const navigationPerformanceType = navigationPerformance ? navigationPerformance.type : NAVIGATION_TYPE[performance.navigation.type];
const isReload = navigationPerformanceType === 'reload';
/**
 * 是否第一次进入网站
 * 排除使用过程跳转到其他页面，又跳转回来
 *
 * @param isExcludePayment 是否排除跳转到支付页面
 * @returns {boolean}
 */

const isFirstIn = isExcludePayment => {
  const isSuccessPage = location.href === '/checkout/success'; // 成功页会经过第三方支付的网站跳过来

  if (!isExcludePayment && isSuccessPage) {
    return false;
  } // 预授权需要跳转到第三方网站


  const payOrigins = ['paypal.com'];
  return navigationPerformanceType === 'navigate' && !document.referrer.startsWith(location.origin) && !(isExcludePayment ? [] : payOrigins).some(item => document.referrer.includes(item));
};
const initHistoryStack = () => {
  if (isFirstIn(true)) {
    historyStack.prev = window.document.referrer;
  } else {
    const data = JSON.parse(sessionStorage.getItem(rfKey) || '{}');
    historyStack.prev = (isReload ? data.prev : data.current) || window.document.referrer;
  }

  pushHistoryStack(window.location.href);
  const ORIGIN_PUSH_STATE = window.history.pushState;

  window.history.pushState = function (...rest) {
    const nextHref = getHref(rest[2]);
    pushHistoryStack(nextHref);
    composePathIndex('pushState', nextHref);
    return ORIGIN_PUSH_STATE.apply(this, rest);
  };

  const ORIGIN_REPLACE_STATE = window.history.replaceState;

  window.history.replaceState = function (...rest) {
    const nextHref = getHref(rest[2]);
    pushHistoryStack(nextHref);
    composePathIndex('replaceState', nextHref);
    return ORIGIN_REPLACE_STATE.apply(this, rest);
  };

  window.addEventListener('popstate', () => {
    pushHistoryStack(window.location.href);
    composePathIndex('popstate');
  }); // window.addEventListener('hashchange', () => {
  //   emitPageView();
  // });
};
const pushHistoryStack = href => {
  setUtm();
  setAd();

  if (!isDiffUrl(href)) {
    return;
  } // 跳过初始浏览页面


  if (historyStack.current) {
    historyStack.prev = historyStack.current;
  }

  historyStack.current = href;
  sessionStorage.setItem(rfKey, JSON.stringify(historyStack));
};
const getHistoryStack = () => {
  return historyStack;
};

const getCookieId = () => {
  let cid = localStorage.getItem(cidKey) || api.get(cidKey);

  if (!cid) {
    cid = `${Math.random().toString(36).substr(2, 10)}.${Date.now().toString().substr(0, 10)}`;
  }

  localStorage.setItem(cidKey, cid); // 同步到 cookie，以方便接口获取

  api.set(cidKey, cid, {
    expires: 365
  });
  return cid;
};
const getSearchCookieId = flagStatus => {
  let searchid = localStorage.getItem(searchidKey) || api.get(searchidKey);

  if (!searchid || flagStatus) {
    const timestamp = Date.now();
    searchid = `${Math.random().toString(36).substr(2, 10)}.${timestamp.toString().substr(0, 10)}`;
  }

  localStorage.setItem(searchidKey, searchid); // 同步到 cookie，以方便接口获取

  api.set(searchidKey, searchid, {
    expires: 365
  });
  return searchid;
};
const getSession = () => {
  // sid，timestamp
  const sidData = getSid(); // 上次触发事件的时间

  const lastTriggerTime = sidData.timestamp; // 会话ID。距离上次事件生成超过30m，或跨日期，重新生成

  let sid;
  let sessionTime;

  if (lastTriggerTime) {
    const currentDate = new Date();
    const prevDate = new Date(lastTriggerTime);
    const isMore30m = currentDate.getTime() - lastTriggerTime > 30 * 60 * 1000; // 中国时区的晚上0点算第二天

    const isAnotherDay = currentDate.getUTCHours() !== prevDate.getUTCHours() && currentDate.getUTCHours() + 8 === 24;

    if (!isMore30m && !isAnotherDay) {
      sid = sidData.sid;
    }
  }

  if (!sid) {
    const timestamp = Date.now();
    sid = `${Math.random().toString(36).substr(2, 10)}.${timestamp.toString().substr(0, 10)}`;
    sessionTime = timestamp;
  }

  setSid({
    sid,
    timestamp: Date.now()
  });
  return {
    sid,
    sessionTime
  };
};
const backupData = {}; // { sid，timestamp }

const setSid = data => {
  const value = JSON.stringify(data);
  localStorage.setItem(sidKey, value);
  api.set(sidKey, value, {
    expires: 1
  });
  sessionStorage.setItem(sidKey, value);
  backupData[sidKey] = data;
}; // HOTFIX: 获取存储最新的值，在多标签页时，某些写入会有延迟


const getSid = () => {
  const cookieSid = JSON.parse(api.get(sidKey) || '{}');
  const localStorageSid = JSON.parse(localStorage.getItem(sidKey) || '{}');
  const sessionStorageSid = JSON.parse(sessionStorage.getItem(sidKey) || '{}');
  const memorySid = backupData[sidKey] || {};
  const arr = [cookieSid, localStorageSid, sessionStorageSid, memorySid];
  let latestData = arr.sort((a, b) => {
    var _b$timestamp, _a$timestamp;

    return ((_b$timestamp = b.timestamp) != null ? _b$timestamp : 0) - ((_a$timestamp = a.timestamp) != null ? _a$timestamp : 0);
  });
  return latestData[0];
};

const MAX_PATH_LENGTH = 50; // 每个路径最多保存的事件量

const MAX_DATA_LENGTH = 3; // 判断是否是搜索页面需要的设置

const isSearchEvent = data => {
  return ['trending_word', 'btn_search', 'recent_word'].includes(data);
};

const getCurrentHref = () => {
  return location.pathname + location.search;
};

const setAttributionData = data => {
  sessionStorage.setItem(attributionKey, JSON.stringify(data != null ? data : getDefaultAttributionData()));
};

const lastBtnQuickShopKey = 'mirage_attribution_last_btn_quick_shop';
const lastSearchKey = 'mirage_attribution_last_search';
const lastFiltersKey = 'mirage_attribution_last_filters';
const lastSortKey = 'mirage_attribution_last_sort'; // 保存访问过的路径栈
// pathIndex   当前处于的路径栈索引位置。后退导航的时候不会删除路径栈数据，只会修改处于的索引位置，方便前进导航的时候带上之前的数据
// pathData
//   path 为路径，包括查询参数。无数据时不存在此字段
//   pathName  为路径名，把具有多个路径的页面统一为一个名称，如首页
//   data 为此路径触发的点击事件
// shelfData   当超过保存访问过的路径栈最大长度时，旧数据保存在这。但是每个相同路由的数据只会在此存在一条
// 格式如下：
// {
//   pathData: [{
//     path: '/',
//   }, {
//     path: '/collect',
//     pathName: '收藏页',
//     data: [{}],
//   }],
//   shelfData = [{
//     path: '/collect',
//     pathName: '收藏页',
//     data: [{}],
//   }],
//   triggerUrl: '/',
//   triggerTime: 1642820976943,
// }

const getAttributionData = () => {
  const storageValue = sessionStorage.getItem(attributionKey);
  return JSON.parse(storageValue) || getDefaultAttributionData();
};

const getCurrentPathName = () => {
  let currentPathData = Object.entries(pathData).find(item => isMatchPath(item[0], location.pathname));

  if (!currentPathData) {
    return '';
  }

  return currentPathData[1][0];
};

const getSearchType = eventId => {
  let search_type = '';

  if (eventId == 'click_trending_word') {
    search_type = '热词';
  } else if (eventId == 'click_recent_word') {
    search_type = '最近搜索词';
  }

  return search_type;
};
/*
 * path: 格式存在/flashsale?seesion=1&activity_type=0的情况，
 * 需要处理成location.pathname格式
 */

const getCurrentPathId = path => {
  if (path.indexOf('?') > -1) {
    path = path.split('?')[0];
  }

  let currentPathData = Object.entries(pathData).find(item => isMatchPath(item[0], path));

  if (!currentPathData) {
    return '';
  }

  return currentPathData[1][1];
};
/**
 * 1、前进到当前页
 * 2、上一个页面是目标页面，对应pageName
 * 3、上一页的数据里，包含埋点事件对象，且该埋点事件是商品点击事件
 *
 * @param {*} param0
 * @returns
 */


const getTriggerEvent = ({
  pathData,
  pageName,
  condition
}) => {
  var _pathData$data;

  if (typeof pageName === 'string' && (pathData == null ? void 0 : pathData.pathName) !== pageName) {
    return;
  }

  if (typeof pageName === 'function' && !pageName(pathData == null ? void 0 : pathData.pathName)) {
    return;
  }

  if (!((_pathData$data = pathData.data) != null && _pathData$data.length)) {
    return;
  }

  const dataItem = pathData.data[pathData.data.length - 1];

  if (!dataItem) {
    return;
  }

  if (typeof condition === 'function' && !condition(dataItem)) {
    return;
  }

  dataItem.page_id = getCurrentPathId(pathData.path);
  return dataItem;
}; // http://wiki.chicv.com/pages/viewpage.action?pageId=68030817


const getFf = () => {
  var _pathData$pathIndex;

  const currentPathName = getCurrentPathName();

  if (currentPathName === '首页') {
    // 首页所有埋点不带ff参数
    return;
  }

  const attributionData = getAttributionData();
  const {
    pathIndex,
    pathData
  } = attributionData;
  return ((_pathData$pathIndex = pathData[pathIndex]) == null ? void 0 : _pathData$pathIndex.ff) || undefined;
}; // http://wiki.chicv.com/pages/viewpage.action?pageId=68030823


const getPp = () => {
  var _pathData$pathIndex2;

  const attributionData = getAttributionData();
  const {
    pathIndex,
    pathData
  } = attributionData;
  return ((_pathData$pathIndex2 = pathData[pathIndex]) == null ? void 0 : _pathData$pathIndex2.pp) || undefined;
};

const getQuickShopData = body => {
  const {
    event_id,
    page_id,
    page_module
  } = body;

  if (!['add_to_cart', 'add_to_cart_result', 'buy_it_now'].includes(event_id)) {
    return;
  } // 商详主商品的加购不处理


  if (page_id === 'page_product_detail' && !page_module) {
    return;
  }

  const lastBtnQuickShopStr = sessionStorage.getItem(lastBtnQuickShopKey);

  if (!lastBtnQuickShopStr) {
    return;
  }

  const lastBtnQuickShop = JSON.parse(lastBtnQuickShopStr);
  const {
    object_id,
    object_type,
    rank,
    collection_id,
    page_module_title,
    recommend_type,
    params,
    attribution_token
  } = lastBtnQuickShop.data;
  const {
    search_type,
    search_position,
    search_nav_name,
    search_event_id,
    fillter_value,
    filter_name_value,
    sorting_name,
    alg_id,
    req_id,
    trans_data
  } = params;
  const result = {
    event_id: "click_btn_quick_shop",
    object_id,
    object_type,
    page_id,
    page_module,
    rank,
    collection_id: collection_id || params.collection_id,
    page_module_title: page_module_title || params.page_module_title,
    recommend_type: recommend_type || params.recommend_type,
    alg_id,
    req_id,
    trans_data,
    attribution_token: attribution_token || params.attribution_token,
    search_type,
    search_position,
    search_nav_name,
    search_event_id,
    fillter_value,
    filter_name_value,
    sorting_name
  };
  return {
    pp: result,
    ff: page_id === 'page_home' ? result : undefined
  };
};

const getAttributionEvent = body => {
  try {
    // 如果是快速加购相关事件，则归因到打开加购弹窗的商品
    const quickShopData = getQuickShopData(body) || {};
    const ff = getFf();
    const pp = getPp();
    return {
      ff: quickShopData.ff || ff,
      pp: quickShopData.pp || pp
    };
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};

const getDefaultAttributionData = () => {
  const currentHref = getCurrentHref();
  return {
    pathIndex: 0,
    pathData: [{
      path: currentHref
    }]
  };
};

const initAttributionData = () => {
  try {
    const attributionData = getAttributionData();

    if (isFirstIn() || !attributionData.pathData || typeof attributionData.pathIndex !== 'number') {
      setAttributionData(getDefaultAttributionData());
    } else {
      composePathIndex(navigationPerformanceType);
    }
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};

const getFfFromPathData = prePathData => {
  const page_name = '首页';
  const searchTriggerEvent = getTriggerEvent({
    pathData: prePathData,

    pageName() {
      return true;
    },

    condition(eventData) {
      const {
        event_type,
        event_id
      } = eventData;

      if (event_type === 'behavior' && isSearchEvent(event_id)) {
        return true;
      }

      return false;
    }

  }); // 首页事件

  const homeTriggerEvent = getTriggerEvent({
    pathData: prePathData,
    pageName: page_name
  }); // 搜索事件

  if (searchTriggerEvent) {
    const {
      nav_name,
      event_id,
      event_type,
      page_id
    } = searchTriggerEvent;
    let nextEventId = composeEventId(event_id, event_type);
    let search_type = getSearchType(nextEventId) || searchTriggerEvent.search_type;
    return {
      event_id: nextEventId,
      object_type: 'keyword',
      object_id: nav_name,
      page_id,
      search_id: getSearchCookieId(),
      search_type
    };
  } else if (homeTriggerEvent) {
    var _ref, _ref2;

    const {
      event_type,
      event_id,
      page_module,
      module_rank,
      rank,
      product_id,
      product,
      adv,
      nav_id,
      nav_name,
      url,
      page_module_title,
      alg_id,
      req_id,
      trans_data,
      alg_type,
      page_id,
      attribution_token
    } = homeTriggerEvent;
    let nextEventId = composeEventId(event_id, event_type); // 无推荐，细刻推荐，AWS推荐，字节元推荐

    let type = '无推荐';

    if (alg_type === 'byte') {
      type = '字节元推荐';
    } else if (alg_id) {
      type = 'AWS推荐';
    } else if (req_id) {
      type = '火山推荐';
    }

    let object_type = undefined;

    if (adv) {
      object_type = 'advertise';
    } else if (product) {
      object_type = 'product';
    } else if (nav_id) {
      object_type = 'nav';
    }

    return {
      object_type,
      event_id: nextEventId,
      // 如果是商品，带的是商品ID
      object_id: (_ref = (_ref2 = product_id != null ? product_id : product) != null ? _ref2 : adv) != null ? _ref : nav_name,
      module_rank,
      rank,
      page_module,
      url,
      page_module_title,
      page_id,
      // page_name: '首页',
      alg_id,
      req_id,
      trans_data,
      attribution_token,
      recommend_type: type
    };
  } else {
    // 没有命中ff场景
    if (prePathData.ff) {
      return prePathData.ff;
    }
  }
};

const getPpFromPathData = prePathData => {
  const triggerEvent = getTriggerEvent({
    pathData: prePathData,

    pageName(pageName) {
      if (pageName === '首页') {
        // 首页全部走ff
        return false;
      }

      return true;
    },

    condition(dataItem) {
      const {
        event_type,
        event_id
      } = dataItem;

      if (event_id === 'product' && event_type === "behavior") {
        return true;
      }

      return false;
    }

  });
  console.log('%c [ triggerEvent ]: ', 'color: #bf2c9f; background: pink; font-size: 13px;', triggerEvent);

  if (triggerEvent) {
    const {
      event_type,
      event_id,
      page_module,
      page_module_title,
      page_module_title_new,
      collection_id,
      rank,
      product,
      alg_id,
      req_id,
      trans_data,
      attribution_token,
      page_id,
      search_type,
      search_position,
      search_nav_name,
      search_event_id,
      fillter_value,
      filter_name_value,
      sorting_name,
      alg_type
    } = triggerEvent;
    let nextEventId = composeEventId(event_id, event_type); // 无推荐，细刻推荐，AWS推荐，字节元推荐

    let type = '无推荐';

    if (alg_type === 'byte') {
      type = '字节元推荐';
    } else if (alg_id) {
      type = 'AWS推荐';
    } else if (req_id) {
      type = '火山推荐';
    }

    return {
      event_id: nextEventId,
      object_id: product,
      object_type: 'product',
      rank,
      page_module,
      page_module_title: page_module_title != null ? page_module_title : page_module_title_new,
      collection_id,
      page_id,
      recommend_type: type,
      alg_id,
      req_id,
      trans_data,
      attribution_token,
      search_type,
      search_position,
      search_nav_name,
      search_event_id,
      fillter_value,
      filter_name_value,
      sorting_name
    };
  } else {
    // 没有命中pp场景
    if (prePathData.pp) {
      return prePathData.pp;
    }
  }
}; // pushState
// replaceState
// popstate  不确定前进，后退
// navigate 通过点击链接，书签和表单提交，或者脚本操作，或者在浏览器的地址栏中输入URL
// back_forward 通过历史记录和前进后退访问
// eslint-disable-next-line sonarjs/cognitive-complexity


const composePathIndex = (action, href = getCurrentHref()) => {
  try {
    const attributionData = getAttributionData();
    let currentHref = href;

    if (currentHref.startsWith(location.origin)) {
      currentHref = currentHref.slice(location.origin.length);
    }

    attributionData.lastNavigateAction = action;
    const preIndex = attributionData.pathIndex;
    const preData = attributionData.pathData[preIndex];

    if (['pushState', 'navigate'].includes(action)) {
      var _attributionData$path;

      // 前进
      if (((_attributionData$path = attributionData.pathData[attributionData.pathIndex]) == null ? void 0 : _attributionData$path.path) !== currentHref) {
        attributionData.pathIndex++;
        attributionData.pathData[attributionData.pathIndex] = {
          path: currentHref,
          time: new Date().getTime()
        };
      } // 跳转后删除后面的路由栈数据


      attributionData.pathData = attributionData.pathData.slice(0, attributionData.pathIndex + 1); // 限制长度

      if (attributionData.pathData.length > MAX_PATH_LENGTH) {
        var _firstPathData$data;

        const firstPathData = attributionData.pathData[0]; // 保存旧数据

        if ((_firstPathData$data = firstPathData.data) != null && _firstPathData$data.length) {
          var _attributionData$shel;

          (_attributionData$shel = attributionData.shelfData) != null ? _attributionData$shel : attributionData.shelfData = [];
          const index = attributionData.shelfData.find(item => item.path === firstPathData.path);

          if (index !== -1) {
            attributionData.shelfData.splice(index, 1);
          }

          const pathRule = firstPathData.path.split('?')[0];
          attributionData.shelfData.push({
            path: pathRule,
            data: firstPathData.data,
            time: firstPathData.time
          });
        }

        attributionData.pathData = attributionData.pathData.slice(1);
        attributionData.pathIndex--;
      }
    } else if (['popstate', 'back_forward'].includes(action)) {
      var _attributionData$path2, _attributionData$path3;

      // A -> B -> A，在B前进or后退，这种场景，由于无法判断浏览器是前进还是后退，故约定取前进
      if (((_attributionData$path2 = attributionData.pathData[preIndex + 1]) == null ? void 0 : _attributionData$path2.path) === currentHref) {
        attributionData.pathIndex++;
      } else if (((_attributionData$path3 = attributionData.pathData[preIndex - 1]) == null ? void 0 : _attributionData$path3.path) === currentHref) {
        attributionData.pathIndex--;
      } else if (preIndex > 1) {
        // 寻找之前的最近的path相同的项
        const tarIx = attributionData.pathData.slice(0, preIndex - 1).findLastIndex(i => i.path === currentHref);

        if (tarIx !== -1) {
          attributionData.pathIndex = tarIx;
        }
      }
    } else if (action === 'replaceState') {
      var _attributionData$path4;

      const isSkip = // next.js 后退时，会依次触发 replaceState 和 popstate。导致获取的 pathIndex 还是前一个页面的
      ((_attributionData$path4 = attributionData.pathData[attributionData.pathIndex - 1]) == null ? void 0 : _attributionData$path4.path) === currentHref || attributionData.pathData[attributionData.pathIndex].path === currentHref;

      if (!isSkip) {
        attributionData.pathData[attributionData.pathIndex] = {
          path: currentHref,
          time: new Date().getTime()
        }; // 跳转后删除后面的路由栈数据

        attributionData.pathData = attributionData.pathData.slice(0, attributionData.pathIndex + 1);
      }
    } // 设置当前项的ff和pp


    const curPathData = attributionData.pathData[attributionData.pathIndex];

    if (typeof curPathData.ff === 'undefined' && attributionData.pathIndex > 0) {
      const prePathData = attributionData.pathData[attributionData.pathIndex - 1];
      const ff = getFfFromPathData(prePathData) || null;
      const pp = getPpFromPathData(prePathData) || null;
      curPathData.ff = ff;
      curPathData.pp = pp;
    }

    setAttributionData(attributionData);
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};

const shouldPushAttributionData = params => {
  const currentPathName = getCurrentPathName();

  if (params.event_id === 'element' || params.event_type !== 'behavior') {
    return false;
  }

  if (currentPathName === '首页') {
    return true;
  }

  if ( // ['商品详情页', '购物车', '支付成功页', '个人中心页', '收藏页', '订单列表页', '订单详情页', '类目商品列表页'].includes(currentPathName) &&
  // params.event_id === 'product' &&
  // ['product_recommend', 'groupsale', 'matchsale', 'history', 'auto_discount', 'free_shipping', 'collection'].includes(params.page_module)
  // 推荐商品，组合购，搭配购、近期浏览，自动折扣、包邮凑单、商品集
  params.event_id === 'product') {
    return true;
  }

  if (isSearchEvent(params.event_id)) {
    // 点击搜索跳转搜索结果页时需要
    return true;
  }

  return false;
};

const pushAttributionData = ({
  data: params,
  fullData
}) => {
  try {
    // 保存最近的一次打开quickShop事件
    if (params.event_id === "btn_quick_shop") {
      sessionStorage.setItem(lastBtnQuickShopKey, JSON.stringify(fullData));
    } // 保存最近的一次search事件


    if (['btn_search', 'recent_word', 'trending_word'].includes(params.event_id)) {
      sessionStorage.setItem(lastSearchKey, JSON.stringify(fullData));
    } // 保存最近一次商品筛选和排序
    // 如果筛选之后，地址栏上粘贴其他筛选的url，会有问题


    if (['pop_fitter_done'].includes(params.event_id)) {
      sessionStorage.setItem(lastFiltersKey, JSON.stringify(fullData));
    }

    if (['pop_fitter_reset'].includes(params.event_id)) {
      sessionStorage.removeItem(lastFiltersKey);
    }

    if (['btn_sorting'].includes(params.event_id)) {
      sessionStorage.setItem(lastSortKey, JSON.stringify(fullData));
    }

    if (params.event_type === 'behavior' && shouldPushAttributionData(params)) {
      var _pathData$pathIndex3, _pathData$pathIndex3$;

      const attributionData = getAttributionData();
      const currentPathName = getCurrentPathName();
      const curretnPath = getCurrentHref();
      const {
        pathData,
        pathIndex
      } = attributionData;
      (_pathData$pathIndex3$ = (_pathData$pathIndex3 = pathData[pathIndex]).data) != null ? _pathData$pathIndex3$ : _pathData$pathIndex3.data = [];
      pathData[pathIndex].pathName = currentPathName;
      pathData[pathIndex].path = curretnPath;
      pathData[pathIndex].data.push(params); // 限制 data 的长度

      const dataLength = pathData[pathIndex].data.length;

      if (dataLength > MAX_DATA_LENGTH) {
        pathData[pathIndex].data = pathData[pathIndex].data.slice(-MAX_DATA_LENGTH);
      }

      setAttributionData(attributionData);
    }
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};

// this method was added to unscopables after implementation
// in popular engines, so it's moved to a separate module


// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('flat');

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _classPrivateFieldGet(receiver, privateMap) {
  var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "get");

  return _classApplyDescriptorGet(receiver, descriptor);
}

function _classPrivateFieldSet(receiver, privateMap, value) {
  var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "set");

  _classApplyDescriptorSet(receiver, descriptor, value);

  return value;
}

function _classExtractFieldDescriptor(receiver, privateMap, action) {
  if (!privateMap.has(receiver)) {
    throw new TypeError("attempted to " + action + " private field on non-instance");
  }

  return privateMap.get(receiver);
}

function _classApplyDescriptorGet(receiver, descriptor) {
  if (descriptor.get) {
    return descriptor.get.call(receiver);
  }

  return descriptor.value;
}

function _classApplyDescriptorSet(receiver, descriptor, value) {
  if (descriptor.set) {
    descriptor.set.call(receiver, value);
  } else {
    if (!descriptor.writable) {
      throw new TypeError("attempted to set read only private field");
    }

    descriptor.value = value;
  }
}

function _classPrivateMethodGet(receiver, privateSet, fn) {
  if (!privateSet.has(receiver)) {
    throw new TypeError("attempted to get private field on non-instance");
  }

  return fn;
}

function _checkPrivateRedeclaration(obj, privateCollection) {
  if (privateCollection.has(obj)) {
    throw new TypeError("Cannot initialize the same private elements twice on an object");
  }
}

function _classPrivateFieldInitSpec(obj, privateMap, value) {
  _checkPrivateRedeclaration(obj, privateMap);

  privateMap.set(obj, value);
}

function _classPrivateMethodInitSpec(obj, privateSet) {
  _checkPrivateRedeclaration(obj, privateSet);

  privateSet.add(obj);
}

var list = [" daum[\\s/]"," deusu/","(?:^|\\s)site","@[a-z]","\\(at\\)[a-z]","\\(github\\.com/","\\[at\\][a-z]","^12345","^<","^[\\w\\s\\.]+/v?\\d+(\\.\\d+)?(\\.\\d{1,10})?$","^[\\w]+$","^ace explorer","^acoon","^active","^ad muncher","^anglesharp/","^anonymous","^apple-pubsub/","^astute srm","^avsdevicesdk/","^axios/","^bidtellect/","^biglotron","^blackboard safeassign","^blocknote.net","^braze sender","^captivenetworksupport","^castro","^cf-uc ","^clamav[\\s/]","^cobweb/","^coccoc","^dap ","^ddg[_-]android","^discourse","^dispatch/\\d","^downcast/","^duckduckgo","^email","^enigma browser","^evernote clip resolver","^facebook","^faraday","^fdm[\\s/]\\d","^getright/","^gozilla/","^hatena","^hobbit","^hotzonu","^hwcdn/","^infox-wisg","^invision","^jeode/","^jetbrains","^jetty/","^jigsaw","^linkdex","^lwp[-:\\s]","^mailchimp\\.com$","^metauri","^microsoft bits","^microsoft data","^microsoft office existence","^microsoft office protocol discovery","^microsoft windows network diagnostics","^microsoft-cryptoapi","^microsoft-webdav-miniredir","^movabletype","^mozilla/\\d\\.\\d \\(compatible;?\\)$","^my browser$","^navermailapp","^netsurf","^node-superagent","^octopus","^offline explorer","^pagething","^panscient","^perimeterx","^php","^postman","^postrank","^python","^read","^reed","^request-promise$","^restsharp/","^shareaza","^shockwave flash","^snapchat","^space bison","^sprinklr","^svn","^swcd ","^t-online browser","^taringa","^test certificate info","^the knowledge ai","^thinklab","^thumbor/","^traackr.com","^tumblr/","^vbulletin","^venus/fedoraplanet","^w3c","^webbandit/","^webcopier","^wget","^whatsapp","^www-mechanize","^xenu link sleuth","^yahoo","^yandex","^zdm/\\d","^zeushdthree","adbeat\\.com","appinsights","archive","ask jeeves/teoma","bit\\.ly/","bluecoat drtr","bot","browsex","burpcollaborator","capture","catch","check","chrome-lighthouse","chromeframe","client","cloud","crawl","daemon","dareboost","datanyze","dataprovider","dejaclick","dmbrowser","download","evc-batch/","feed","fetch","firephp","freesafeip","ghost","gomezagent","google","headlesschrome/","http","httrack","hubspot marketing grader","hydra","ibisbrowser","images","index","ips-agent","java","jorgee","library","mail\\.ru/","manager","monitor","morningscore/","neustar wpm","news","nutch","offbyone","optimize","pagespeed","parse","perl","phantom","pingdom","powermarks","preview","probe","proxy","ptst[\\s/]\\d","reader","rexx;","rigor","rss","scan","scrape","search","server","sogou","sparkler/","spider","statuscake","stumbleupon\\.com","supercleaner","synapse","synthetic","taginspector/","toolbar","torrent","tracemyfile","transcoder","trendsmapresolver","twingly recon","url","valid","virtuoso","wappalyzer","webglance","webkit2png","websitemetadataretriever","whatcms/","wordpress","zgrab"];

/**
 * Mutate given list of patter strings
 * @param {string[]} list
 * @returns {string[]}
 */
function amend(list) {
  try {
    // Risk: Uses lookbehind assertion, avoid breakage in parsing by using RegExp constructor
    new RegExp('(?<! cu)bot').test('dangerbot'); // eslint-disable-line prefer-regex-literals
  } catch (error) {
    // Skip regex fixes
    return list;
  } // Addresses: Cubot device


  list.splice(list.lastIndexOf('bot'), 1);
  list.push('(?<! cu)bot'); // Addresses: Android webview

  list.splice(list.lastIndexOf('google'), 1);
  list.push('(?<! (channel\\/|google\\/))google(?!(app|\\/google))'); // Addresses: Yandex browser

  list.splice(list.lastIndexOf('search'), 1);
  list.push('(?<! (ya|yandex))search'); // Addresses: libhttp browser

  list.splice(list.lastIndexOf('http'), 1);
  list.push('(?<!(lib))http'); // Addresses: java based browsers

  list.splice(list.lastIndexOf('java'), 1);
  list.push('java(?!;)'); // Addresses: Mozilla nightly build https://github.com/mozilla-mobile/android-components/search?q=MozacFetch

  list.splice(list.lastIndexOf('fetch'), 1);
  list.push('(?<!(mozac))fetch');
  return list;
}

amend(list);
var flags = 'i';
/**
 * Test user agents for matching patterns
 */

var _list = /*#__PURE__*/new WeakMap();

var _pattern = /*#__PURE__*/new WeakMap();

var _update = /*#__PURE__*/new WeakSet();

var _index = /*#__PURE__*/new WeakSet();

var Isbot = /*#__PURE__*/function () {
  /**
   * @type {string[]}
   */

  /**
   * @type {RegExp}
   */
  function Isbot(patterns) {
    var _this = this;

    _classCallCheck(this, Isbot);

    _classPrivateMethodInitSpec(this, _index);

    _classPrivateMethodInitSpec(this, _update);

    _classPrivateFieldInitSpec(this, _list, {
      writable: true,
      value: void 0
    });

    _classPrivateFieldInitSpec(this, _pattern, {
      writable: true,
      value: void 0
    });

    _classPrivateFieldSet(this, _list, patterns || list.slice());

    _classPrivateMethodGet(this, _update, _update2).call(this);

    var isbot = function isbot(ua) {
      return _this.test(ua);
    };

    return Object.defineProperties(isbot, Object.getOwnPropertyNames(Isbot.prototype).filter(function (prop) {
      return !['constructor'].includes(prop);
    }).reduce(function (accumulator, prop) {
      return Object.assign(accumulator, _defineProperty({}, prop, {
        get: function get() {
          return _this[prop].bind(_this);
        }
      }));
    }, {}));
  }
  /**
   * Recreate the pattern from rules list
   */


  _createClass(Isbot, [{
    key: "test",
    value:
    /**
     * Match given string against out pattern
     * @param  {string} ua User Agent string
     * @returns {boolean}
     */
    function test(ua) {
      return Boolean(ua) && _classPrivateFieldGet(this, _pattern).test(ua);
    }
    /**
     * Get the match for strings' known crawler pattern
     * @param  {string} ua User Agent string
     * @returns {string|null}
     */

  }, {
    key: "find",
    value: function find() {
      var ua = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var match = ua.match(_classPrivateFieldGet(this, _pattern));
      return match && match[0];
    }
    /**
     * Get the patterns that match user agent string if any
     * @param  {string} ua User Agent string
     * @returns {string[]}
     */

  }, {
    key: "matches",
    value: function matches() {
      var ua = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      return _classPrivateFieldGet(this, _list).filter(function (entry) {
        return new RegExp(entry, flags).test(ua);
      });
    }
    /**
     * Clear all patterns that match user agent
     * @param  {string} ua User Agent string
     * @returns {void}
     */

  }, {
    key: "clear",
    value: function clear() {
      var ua = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      this.exclude(this.matches(ua));
    }
    /**
     * Extent patterns for known crawlers
     * @param  {string[]} filters
     * @returns {void}
     */

  }, {
    key: "extend",
    value: function extend() {
      var _this2 = this;

      var filters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      [].push.apply(_classPrivateFieldGet(this, _list), filters.filter(function (rule) {
        return _classPrivateMethodGet(_this2, _index, _index2).call(_this2, rule) === -1;
      }).map(function (filter) {
        return filter.toLowerCase();
      }));

      _classPrivateMethodGet(this, _update, _update2).call(this);
    }
    /**
     * Exclude patterns from bot pattern rule
     * @param  {string[]} filters
     * @returns {void}
     */

  }, {
    key: "exclude",
    value: function exclude() {
      var filters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var length = filters.length;

      while (length--) {
        var index = _classPrivateMethodGet(this, _index, _index2).call(this, filters[length]);

        if (index > -1) {
          _classPrivateFieldGet(this, _list).splice(index, 1);
        }
      }

      _classPrivateMethodGet(this, _update, _update2).call(this);
    }
    /**
     * Create a new Isbot instance using given list or self's list
     * @param  {string[]} [list]
     * @returns {Isbot}
     */

  }, {
    key: "spawn",
    value: function spawn(list) {
      return new Isbot(list || _classPrivateFieldGet(this, _list));
    }
  }]);

  return Isbot;
}();

function _update2() {
  _classPrivateFieldSet(this, _pattern, new RegExp(_classPrivateFieldGet(this, _list).join('|'), flags));
}

function _index2(rule) {
  return _classPrivateFieldGet(this, _list).indexOf(rule.toLowerCase());
}

var isbot = new Isbot();

const errorTip = '埋点需要添加 event_id 字段';
const verifyEventId = data => {
  const {
    event_id,
    event_type
  } = data;

  if (event_type === 'behavior' && !event_id) {
    throw new Error(`行为${errorTip}`);
  }

  if (event_type === 'impression' && !event_id) {
    throw new Error(`曝光${errorTip}`);
  }

  if (!event_id) {
    return;
  }

  ['click_', 'impression_'].forEach(item => {
    if (event_id.startsWith(item)) {
      throw new Error(`event_id 不需要添加 ${item}`);
    }
  });
};

let eventIndex = 0;
let uniquePageId;
/**
 *  header 公共采集字段
 *
 * @param href
 * @param url
 */

const getRequireHeader = url => {
  var _Cookies$get, _Cookies$get2, _navigator, _navigator$connection, _Cookies$get3, _Cookies$get4, _Cookies$get5;

  // 域名
  const domain = window.location.hostname;
  const historyStack = getHistoryStack(); // 来源。上一个页面URL

  const refer_url = historyStack.prev || window.document.referrer; // 用户端语言

  const user_lang = window.navigator.language; // 用户在细刻公司内部的唯一标识ID

  const user_id = getUserId(); // 应用生成的用户ID

  const cookie_id = getCookieId();
  const session = getSession(); // 会话ID。距离上次操作超过30m，或跨日期，重新生成

  const session_id = session.sid; // 会话开始时间。在session_id首次生成上传

  const session_time = session.sessionTime;
  const {
    order_prefix = 'hb',
    ace_store_id,
    currency_code
  } = getSetting(); // hb+站点ID

  const site = `${order_prefix.toLowerCase()}${ace_store_id}`; // 数据来源（设备）

  const app_type = getAppType();
  const currentData = new Date();
  const timezoneOffset = currentData.getTimezoneOffset(); // 时区。储存为分钟

  const timezone = `${timezoneOffset > 0 ? '-' : '+'}${Math.abs(timezoneOffset)}`; // 币种

  const currency = api.get('currency') || currency_code || 'USD'; // 国家/城市数据

  const countryCityData = JSON.parse(api.get('x-default-country') || '{}');
  const {
    value = '',
    city = '',
    state = ''
  } = countryCityData; // 渠道广告参数

  const cv_chl = ''; // 广告绑定时间

  const cv_ts = '';
  const utm = getUtm(); // 广告归因标识

  const {
    utm_source = '',
    utm_code = '',
    creative = ''
  } = utm; // 广告id

  const {
    ad_id: init_ad_id = '',
    creative: ad_creative = ''
  } = getAd();
  const ad_id = init_ad_id || ad_creative; // 订阅邮箱

  const subscribe_email = localStorage.getItem('sh_userEmail') || api.get('subscribe-email'); // A/B 测试的 cookie 值

  const epm_variation = (_Cookies$get = api.get('epm_variation_v2')) != null ? _Cookies$get : '';
  const [ab_test_id = '', ab_test_type = ''] = epm_variation.split(':');
  const test_variations = (_Cookies$get2 = api.get('test_variations')) != null ? _Cookies$get2 : ''; // ab 测试详细信息

  const ab_test_detail = {};
  const abArray = test_variations.split(',');
  abArray.forEach((item, index) => {
    if (item) {
      const [ab_id, ab_type] = item.split(':');
      ab_test_detail[ab_id + ''] = ab_type;
    }
  });
  const bot = isbot(navigator.userAgent) ? 1 : 0; // 网络类型	2G,3G,4G
  // eslint-disable-next-line compat/compat

  const network_type = (_navigator = navigator) == null ? void 0 : (_navigator$connection = _navigator.connection) == null ? void 0 : _navigator$connection.effectiveType;
  const dom_length = document.querySelectorAll('*').length; // 屏幕分辨率

  const screen_resolution = `${window.screen.width}X${window.screen.height}`; // 当前的可视区域大小

  const viewport_resolution = `${window.innerWidth || document.documentElement.offsetWidth}X${window.innerHeight || document.documentElement.offsetHeight}`; // 当前标签页的唯一 ID

  const tab_id = sessionStorage.getItem(tabKey); // 获取_ga

  const _ga = (_Cookies$get3 = api.get('_ga')) != null ? _Cookies$get3 : ''; // 获取_gid


  const _gid = (_Cookies$get4 = api.get('_gid')) != null ? _Cookies$get4 : ''; // 获取是否是fb用户


  const is_fb_user = (_Cookies$get5 = api.get('is_fb_user')) != null ? _Cookies$get5 : 0;
  return {
    domain,
    url,
    refer_url,
    user_lang,
    user_id,
    cookie_id,
    session_id,
    session_time,
    site,
    app_type,
    timezone,
    currency,
    cv_chl,
    cv_ts,
    utm_source,
    utm_code,
    subscribe_email,
    ab_test_id,
    ab_test_type,
    ab_test_detail,
    bot,
    network_type,
    dom_length,
    screen_resolution,
    viewport_resolution,
    tab_id,
    city,
    state,
    country: value,
    advertise_track_id: creative,
    _ga,
    _gid,
    ad_id,
    is_fb_user
  };
};

const getRequireData = (url, event_time, event_type) => {
  // 页面路径
  const page_path = getPathName(url);
  let currentPathData = Object.entries(pathData).find(item => isMatchPath(item[0], page_path)); // TODO:

  if (!currentPathData) {
    currentPathData = ['/undefined', ['undefined', 'undefined']];
  } // 页面标识ID


  const page_id = currentPathData[1][1]; // 页面名称

  const page_name = currentPathData[1][0]; // 页面标题

  const page_title = window.document.title; // 页面唯一标识流水号

  let unique_page_id;

  if (event_type === 'page') {
    // 生成规则：page_id + "_"+时间戳
    unique_page_id = `${page_id}_${event_time}`;
    uniquePageId = unique_page_id;
  } else {
    // 行为发生时所在的页面唯一标识流水号
    unique_page_id = uniquePageId;
  } // 事件唯一性标识流水号。生成规则：page_id + "_"+触发时间戳


  let unique_event_id;

  if (event_type === 'behavior') {
    unique_event_id = `${page_id}_${event_time}`;
  }

  return {
    page_id,
    page_name,
    page_path,
    page_title,
    unique_page_id,
    unique_event_id
  };
};
/**
 * 数据包体结构
 *
 * @param body
 */


const composeSendData = body => {
  // event_type 埋点事件类型：
  // 页面埋点：page
  // 行为埋点：behavior
  // 曝光埋点：impression
  // 监控埋点：monitor、error
  const {
    url,
    event_type,
    ext_info,
    params,
    event_id,
    page_module,
    rank,
    module_rank,
    items,
    ...rest
  } = body;
  verifyEventId(body);
  let nextEventId = composeEventId(event_id, event_type); // 埋点日志流水唯一标识。随机生成32位字符串

  const trace_id = getTraceId(); // 埋点发送自增序列号

  const event_index = ++eventIndex; // TODO: 重试
  // 上报失败后，重试次数

  const retry_times = 0; // 埋点日志类型：
  // 启动：launch
  // 结束：terminate
  // 一般事件: event
  // 监控：monitor

  const log_type = 'event'; // 客户端的日志上报时间

  const event_time = Date.now();
  const historyStack = getHistoryStack(); // 页面埋点跟其他埋点的 url 字段的作用不一样，储存的位置也不一样，需要额外处理。以支持其他埋点传递 url 字段

  const pageEventUrl = event_type === 'page' ? url : undefined;
  const notPageEventUrl = event_type !== 'page' ? url : undefined; // 页面URL，完成的链接URL，含域名+路径+参数
  // pageview 事件会修改 historyStack.current，但是某些事件会比他先执行，导致 historyStack.current 为 undefined
  // pushState 触发 pageview 的时候，window.location.href 还未更新，获取的是旧值

  const nextUrl = pageEventUrl || historyStack.current || window.location.href; // 公共采集字段属性，采用json格式

  const header = getRequireHeader(nextUrl);
  const requireData = getRequireData(nextUrl, event_time, event_type); // 埋点业务属性

  let data; // 曝光 API 去掉了 items 嵌套，需要添加到 items 字段

  if (event_type === 'impression' && !items) {
    data = { ...requireData,
      event_id: nextEventId,
      page_module,
      items: [{
        ext_info: { ...getAttributionEvent({ ...body,
            ...requireData
          }),
          ...ext_info
        },
        url: notPageEventUrl,
        params,
        rank,
        module_rank,
        ...rest
      }]
    };
  } else {
    const nextParams = {
      url: notPageEventUrl,
      ...params,
      ...rest
    };
    const nextItems = items == null ? void 0 : items.map(item => ({ ...item,
      event_id: composeEventId(item.event_id, event_type)
    }));
    data = { ...requireData,
      event_id: nextEventId,
      page_module,
      rank,
      module_rank,
      ext_info: { ...getAttributionEvent({ ...body,
          ...requireData
        }),
        ...ext_info
      },
      items: nextItems,
      params: nextParams
    };
  }

  const nextData = composeData(data, event_type);
  return {
    trace_id,
    event_index,
    retry_times,
    log_type,
    event_type,
    event_time,
    header,
    data: nextData
  };
};
/*
 * object_type、object_type2 对字段有顺序要求，例如 object_type 是 product，object_type2 是 sku
 * 反之 object_type 是 sku，object_type2 是 product，是不允许的
 * 故用二维数组定义字段的顺序
 *
 * 已知顺序：
 * third_category
 * product  sku
 * keyword
 * flash
 * activity
 * order
 * adv  url
 * url
 * third_category  url
 * flash  url
 * activity  url
 * order  product
 * address
 * coupon
 * */

const BUSINESS_FIELDS = [// 页面数据，需要排在最前面的字段
['third_category', 'order', 'keyword', 'flash', 'activity', 'adv'], // 商品数据
['product', 'sku'], ['url', 'address', 'coupon'] // address, coupon 只出现一次，待确定位置，暂放在最后面
];
/*
 * 对 params 的字段进行整理到 object_type、object_id，并从 params 字段移动到 data 字段
 * 如 product: 123，变成 object_type: 'product', object_id: 123
 * 只对 页面埋点、行为埋点 进行处理
 * */

const composeData = (data, event_type) => {
  if (event_type !== 'page' && event_type !== 'behavior') {
    return data;
  }

  const nextData = { ...data
  };
  const params = { ...nextData.params
  };
  const flatBusinessFields = BUSINESS_FIELDS.flat();
  const paramsKeys = Object.keys(params);
  let objectTypeIndex = 1;
  flatBusinessFields.forEach(item => {
    // !== undefined 去掉无效数据，例如 埋点 会存在一个 url 为 undefined 的数据。且值为 undefined 的字段不会发送到接口
    if (paramsKeys.includes(item) && params[item] !== undefined) {
      const fieldSuffix = objectTypeIndex === 1 ? '' : objectTypeIndex;
      nextData[`object_type${fieldSuffix}`] = item;
      nextData[`object_id${fieldSuffix}`] = params[item];
      objectTypeIndex++;
      params[item] = undefined;
    }
  });
  return { ...nextData,
    params
  };
}; // 对数据进行合并再发送，以减少接口数量


const sendExposureData = waitSendData => {
  if (!waitSendData.length) {
    return;
  }

  const data = waitSendData.map(item => {
    return JSON.parse(item.dataSource);
  });
  const sortDataByEventId = {};
  const sortData = data.sort((a, b) => a.rank - b.rank);
  sortData.forEach(item => {
    const key = `${item.event_id}/${item.page_module}`;

    if (!sortDataByEventId[key]) {
      sortDataByEventId[key] = [];
    }

    sortDataByEventId[key].push(item);
  }); // 对同个 event_id、page_module 字段的数据合为一个接口发送

  Object.values(sortDataByEventId).forEach(value => {
    const items = value.map(({
      event_id,
      page_module,
      ...rest
    }) => rest);
    const {
      event_id,
      page_module,
      item_list_id,
      item_list_name
    } = value[0];
    push({
      event_type: 'impression',
      event_id,
      page_module,
      items
    }, () => {
      if (typeof window.viewItemList === 'function' && (event_id === 'product' || event_id === 'advertise' && ['product_recommend'].includes(page_module))) {
        window.viewItemList({
          item_list_id: item_list_id || localStorage.getItem('last_view_item_list_id') || '',
          item_list_name: item_list_name || localStorage.getItem('last_view_item_list_name') || '',
          items
        });
      }
    });
  });
};

const isPC = getAppType() === 'web_pc';
const origin = isTest ? 'https://jingwei-cozy-test.chicv.com' : 'https://jingwei.harborcdn.com';
const path = `/v1/dot/topic/bury-log-${isPC ? 'web' : 'm'}`;
const url = `${origin}${path}`;
const sendData = async data => {
  let nextData = data;

  try {
    var _await$window$collect;

    const response = (_await$window$collect = await (window.collectDataCallBack == null ? void 0 : window.collectDataCallBack(data))) != null ? _await$window$collect : {};

    if (response.skipUpload) {
      return;
    } else if (response.data) {
      nextData = response.data;
    }
  } catch (error) {
    log(error);
  }

  const body = JSON.stringify(nextData);

  if (navigator.sendBeacon) {
    const isWorked = navigator.sendBeacon(url, body);

    if (isWorked) {
      return;
    }
  }

  if (fetch) {
    fetch(url, {
      method: 'POST',
      body,
      keepalive: true
    });
  } else {
    const xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.send(body);

    if (!sendData.hasBlock) {
      window.addEventListener('unload', () => {
      }, false);
    }

    sendData.hasBlock = true;
  }
};

var listenError = (() => {
  // 捕捉 promise 错误
  window.addEventListener('unhandledrejection', function (event) {
    push({
      event_type: 'error',
      message: event.reason,
      type: 'promise-unhandledrejection'
    });
  }); // 捕获 JavaScript 运行时错误和资源加载错误

  window.addEventListener('error', error => {
    // 网络资源加载错误，因为没有 error.message 属性，所以也就没有额外信息获取具体加载的错误细节
    if (!error.message) {
      push({
        event_type: 'error',
        message: `request fail ${error.target.tagName} ${error.target.src || error.target.href}`,
        type: 'resource-request'
      });
    } else {
      push({
        event_type: 'error',
        message: error.error,
        type: 'synchronous-code'
      });
    }
  }, true); //  TODO: 过段时间全上线

  if (location.hostname.split('.').length > 2 && !isTest) {
    return;
  }

  if (window.XMLHttpRequest) {
    class NextXMLHttpRequest extends XMLHttpRequest {
      constructor() {
        super(); // stream 代码重新定义了 XMLHttpRequest 导致不会执行 open 方法

        this.addEventListener('loadend', event => {
          var _this$_request;

          (_this$_request = this._request) != null ? _this$_request : this._request = {};
          const url$1 = event.target.responseURL || this._request.url;
          const method = this._request.method;
          const status = event.target.status || this._request.status;

          if (!url$1) {
            return;
          }

          const message = `${method} ${url$1} ${status}`;
          const isOk = status >= 200 && status < 300 || status === 304;

          if (!isOk && url$1 !== url) {
            push({
              event_type: 'error',
              message: message,
              type: 'XMLHttpRequest'
            });
          }
        });
      }

      open(...rest) {
        super.open(...rest);
        this._request = {
          method: rest[0],
          url: rest[1]
        };
      }

    }

    window.XMLHttpRequest = NextXMLHttpRequest;
  } // if (window.XMLHttpRequest) {
  //   var originalOpen = XMLHttpRequest.prototype.open;
  //   XMLHttpRequest.prototype.open = function (...args) {
  //     const xhr = this;
  //     console.log(1, xhr)
  //
  //     xhr.addEventListener('readystatechange', function () {
  //       if (xhr.readyState === 4) {
  //         console.log(xhr);
  //       }
  //     });
  //
  //     return originalOpen.apply(xhr, args);
  //   };
  //
  //   var originalSend = XMLHttpRequest.prototype.send;
  //   XMLHttpRequest.prototype.send = function (...args) {
  //     console.log(11, this)
  //     return originalSend.apply(this, args);
  //   };
  // }


  if (window.fetch) {
    var orig_FETCH = window.fetch;

    const getFetchMethod = fetchArgs => {
      if ('Request' in window && fetchArgs[0] instanceof Request && fetchArgs[0].method) {
        return fetchArgs[0].method;
      }

      if (fetchArgs[1] && fetchArgs[1].method) {
        return fetchArgs[1].method;
      }

      return 'get';
    };

    const getFetchUrl = fetchArgs => {
      if (typeof fetchArgs[0] === 'string') {
        return fetchArgs[0];
      }

      if ('Request' in window && fetchArgs[0] instanceof Request) {
        return fetchArgs[0].url;
      }

      return String(fetchArgs[0]);
    };

    window.fetch = function (...rest) {
      const _request = {
        method: getFetchMethod(rest),
        url: getFetchUrl(rest)
      };
      return orig_FETCH.apply(this, rest).then(response => {
        const isOk = response.status >= 200 && response.status < 300 || response.status === 304;

        if (!isOk && _request.url !== url) {
          const message = `${_request.method} ${_request.url} ${response.status}`;
          push({
            event_type: 'error',
            message: message,
            type: 'fetch'
          });
        }

        return response;
      }, error => {
        const message = `${_request.method} ${_request.url}`;
        push({
          event_type: 'error',
          message: message,
          type: 'fetch'
        });
        throw error;
      });
    };
  }
});

var MATCH = wellKnownSymbol$1('match');

// `IsRegExp` abstract operation
// https://tc39.es/ecma262/#sec-isregexp
var isRegexp = function (it) {
  var isRegExp;
  return isObject$1(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : classofRaw$1(it) == 'RegExp');
};

// `RegExp.prototype.flags` getter implementation
// https://tc39.es/ecma262/#sec-get-regexp.prototype.flags
var regexpFlags = function () {
  var that = anObject$1(this);
  var result = '';
  if (that.global) result += 'g';
  if (that.ignoreCase) result += 'i';
  if (that.multiline) result += 'm';
  if (that.dotAll) result += 's';
  if (that.unicode) result += 'u';
  if (that.sticky) result += 'y';
  return result;
};

var floor = Math.floor;
var charAt = functionUncurryThis$1(''.charAt);
var replace$1 = functionUncurryThis$1(''.replace);
var stringSlice$1 = functionUncurryThis$1(''.slice);
var SUBSTITUTION_SYMBOLS = /\$([$&'`]|\d{1,2}|<[^>]*>)/g;
var SUBSTITUTION_SYMBOLS_NO_NAMED = /\$([$&'`]|\d{1,2})/g;

// `GetSubstitution` abstract operation
// https://tc39.es/ecma262/#sec-getsubstitution
var getSubstitution = function (matched, str, position, captures, namedCaptures, replacement) {
  var tailPos = position + matched.length;
  var m = captures.length;
  var symbols = SUBSTITUTION_SYMBOLS_NO_NAMED;
  if (namedCaptures !== undefined) {
    namedCaptures = toObject$1(namedCaptures);
    symbols = SUBSTITUTION_SYMBOLS;
  }
  return replace$1(replacement, symbols, function (match, ch) {
    var capture;
    switch (charAt(ch, 0)) {
      case '$': return '$';
      case '&': return matched;
      case '`': return stringSlice$1(str, 0, position);
      case "'": return stringSlice$1(str, tailPos);
      case '<':
        capture = namedCaptures[stringSlice$1(ch, 1, -1)];
        break;
      default: // \d\d?
        var n = +ch;
        if (n === 0) return match;
        if (n > m) {
          var f = floor(n / 10);
          if (f === 0) return match;
          if (f <= m) return captures[f - 1] === undefined ? charAt(ch, 1) : captures[f - 1] + charAt(ch, 1);
          return match;
        }
        capture = captures[n - 1];
    }
    return capture === undefined ? '' : capture;
  });
};

var REPLACE = wellKnownSymbol$1('replace');
var RegExpPrototype = RegExp.prototype;
var TypeError$1 = global$2.TypeError;
var getFlags = functionUncurryThis$1(regexpFlags);
var indexOf = functionUncurryThis$1(''.indexOf);
var replace = functionUncurryThis$1(''.replace);
var stringSlice = functionUncurryThis$1(''.slice);
var max = Math.max;

var stringIndexOf = function (string, searchValue, fromIndex) {
  if (fromIndex > string.length) return -1;
  if (searchValue === '') return fromIndex;
  return indexOf(string, searchValue, fromIndex);
};

// `String.prototype.replaceAll` method
// https://tc39.es/ecma262/#sec-string.prototype.replaceall
_export$1({ target: 'String', proto: true }, {
  replaceAll: function replaceAll(searchValue, replaceValue) {
    var O = requireObjectCoercible$1(this);
    var IS_REG_EXP, flags, replacer, string, searchString, functionalReplace, searchLength, advanceBy, replacement;
    var position = 0;
    var endOfLastMatch = 0;
    var result = '';
    if (searchValue != null) {
      IS_REG_EXP = isRegexp(searchValue);
      if (IS_REG_EXP) {
        flags = toString$2(requireObjectCoercible$1('flags' in RegExpPrototype
          ? searchValue.flags
          : getFlags(searchValue)
        ));
        if (!~indexOf(flags, 'g')) throw TypeError$1('`.replaceAll` does not allow non-global regexes');
      }
      replacer = getMethod$1(searchValue, REPLACE);
      if (replacer) {
        return functionCall$1(replacer, searchValue, O, replaceValue);
      } else if (IS_REG_EXP) {
        return replace(toString$2(O), searchValue, replaceValue);
      }
    }
    string = toString$2(O);
    searchString = toString$2(searchValue);
    functionalReplace = isCallable$1(replaceValue);
    if (!functionalReplace) replaceValue = toString$2(replaceValue);
    searchLength = searchString.length;
    advanceBy = max(1, searchLength);
    position = stringIndexOf(string, searchString, 0);
    while (position !== -1) {
      replacement = functionalReplace
        ? toString$2(replaceValue(searchString, position, string))
        : getSubstitution(searchString, string, position, [], undefined, replaceValue);
      result += stringSlice(string, endOfLastMatch, position) + replacement;
      endOfLastMatch = position + searchLength;
      position = stringIndexOf(string, searchString, position + advanceBy);
    }
    if (endOfLastMatch < string.length) {
      result += stringSlice(string, endOfLastMatch);
    }
    return result;
  }
});

var entryVirtual = function (CONSTRUCTOR) {
  return path$1[CONSTRUCTOR + 'Prototype'];
};

var replaceAll$4 = entryVirtual('String').replaceAll;

var StringPrototype = String.prototype;

var replaceAll$3 = function (it) {
  var own = it.replaceAll;
  return typeof it == 'string' || it === StringPrototype
    || (objectIsPrototypeOf$1(StringPrototype, it) && own === StringPrototype.replaceAll) ? replaceAll$4 : own;
};

var replaceAll$2 = replaceAll$3;

var replaceAll$1 = replaceAll$2;

var replaceAll = replaceAll$1;

/**
 * 如果指定的元素在可视窗口/父元素中可见，则返回 true，否则返回 false
 *
 * @param el dom 元素
 * @param container 默认为视口窗口，也可设置为一个父元素
 * @param partiallyVisible 省略partiallyVisible参数来判断元素是否完全可见，或者指定 true 来判断它是否部分可见
 * @returns {boolean}
 */
const isElementVisible = (el, container, partiallyVisible = false) => {
  const {
    top,
    left,
    bottom,
    right
  } = el.getBoundingClientRect();
  let containerTop;
  let containerLeft;
  let containerBottom;
  let containerRight;

  if (container) {
    const containerBoundingClientRect = container.getBoundingClientRect();
    containerTop = containerBoundingClientRect.top;
    containerLeft = containerBoundingClientRect.left;
    containerBottom = containerBoundingClientRect.bottom;
    containerRight = containerBoundingClientRect.right;
  } else {
    containerTop = 0;
    containerLeft = 0;
    containerBottom = window.innerHeight;
    containerRight = window.innerWidth;
  }

  const isInVisualRange = partiallyVisible ? (top >= containerTop && top <= containerBottom || bottom >= containerTop && bottom <= containerBottom) && (left >= containerLeft && left <= containerRight || right >= containerLeft && right <= containerRight) : top >= containerTop && left >= containerLeft && bottom <= containerBottom && right <= containerRight;

  if (isInVisualRange) {
    const computedStyle = window.getComputedStyle(el); // 判断 dom 是否设置了不可见的样式

    const hasHiddenStyle = computedStyle.opacity === '0' || computedStyle.display === 'none' || computedStyle.visibility === 'hidden';
    return !hasHiddenStyle;
  }

  return isInVisualRange;
};
/**
 * 元素是否显示在最顶层
 *
 * @param dom
 * @param boundingClientRect
 * @returns {boolean|*}
 */

const isElementOnTop = dom => {
  var _topElement$classList;

  const boundingClientRect = dom.getBoundingClientRect();
  let {
    left,
    right
  } = boundingClientRect; // 不计算在窗口外的

  let top = boundingClientRect.bottom > 0 && boundingClientRect.top < 0 ? 0 : boundingClientRect.top;
  let bottom = boundingClientRect.bottom > window.innerHeight && boundingClientRect.top < window.innerHeight ? window.innerHeight : boundingClientRect.bottom; // 以元素的中间像素定位

  let x = (left + right) / 2;
  let y = (top + bottom) / 2;
  const topElement = document.elementFromPoint(x, y);
  return topElement === dom || dom.contains(topElement) || ( // swiper 容器会有影响，只会获取到容器，设为 true
  topElement == null ? void 0 : (_topElement$classList = topElement.classList) == null ? void 0 : _topElement$classList.contains('swiper-wrapper'));
};

const DATA_ATTR = 'data-collect';
const EXPOSURE_DATA_ATTR = 'data-collect-impression';
const CLICK_DATA_ATTR = 'data-collect-click';
const COLLECT_DATA_STORAGE = 'collectDataStorage'; // 是否暂停曝光事件

let isPauseExposure = true; // 等待触发曝光事件的数据，触发需要保持曝光一定时间
// {
//   startTime: Date.now(),
//   dom: Element,
//   dataSource: 'string',
// }

let waitExposureData = []; // 已经触发曝光事件的数据
// 对应 waitExposureData 的 dataSource 字段

let statisExposureEventData = []; // 等待触发曝光事件，需要保持曝光的时间

const waitExposureTime = 600; // 默认添加在 data-collect 属性上

const extraStatis = [// 监听 livechat 的曝光
// {
//   selector: '#chat-widget',
//   data: {
//     event_id: 'modal_customer_service',
//   },
// },
// stream 订阅浮层
{
  selector: '.stream-subscribe-component',
  selectorAttr: EXPOSURE_DATA_ATTR,
  data: {
    event_id: 'pop_ups'
  }
}, {
  selector: '.stream-subscribe-component .close-btn',
  selectorAttr: CLICK_DATA_ATTR,
  data: {
    event_id: 'delete_pop_ups'
  }
}, {
  selector: '.stream-subscribe-component .email-input',
  selectorAttr: CLICK_DATA_ATTR,
  data: {
    event_id: 'input_pop_ups'
  }
}, {
  selector: '.stream-subscribe-component .stream-subscribe-button',
  selectorAttr: CLICK_DATA_ATTR,
  data: {
    event_id: 'pop_ups'
  }
} // 成功页的谷歌问卷调查
// {
//   selector: 'iframe[src^="https://www.google.com/shopping/customerreviews"]',
//   data: () => {
//     return {
//       event_id: 'gcr',
//       email:
//         window.__NEXT_DATA__?.props?.initialProps?.pageProps?.orderDetail
//           ?.originInfo?.email || window.success_data?.order_detail?.email,
//       ti:
//         window.__NEXT_DATA__?.props?.initialProps?.pageProps?.orderDetail
//           ?.originInfo?.order_no ||
//         window.success_data?.order_detail?.order_no,
//     };
//   },
// },
];

const conversion2StatisDom = statis => {
  const {
    selector,
    data,
    selectorAttr = DATA_ATTR
  } = statis;
  const dom = document.querySelector(selector);

  if (dom) {
    if (!dom.getAttribute(selectorAttr)) {
      const statisData = typeof data === 'function' ? data() : data;
      dom.setAttribute(selectorAttr, JSON.stringify(statisData));
    }

    return dom;
  }
};

const isValidDataSource = dataSource => dataSource && dataSource !== '{}' && dataSource.startsWith('{');

const isShouldExposure = dom => {
  const isVisible = isElementVisible(dom, null, true); // 使用 offsetHeight 会有问题

  const boundingClientRect = dom.getBoundingClientRect(); // 调试曝光

  /* if (dom.getAttribute(DATA_ATTR).includes('advertise_top')) {
    console.log(dom);
    console.log({ isVisible });
    console.log(dom.getBoundingClientRect());
    console.log({ isElementOnTop: isElementOnTop(dom) });
  } */

  return isVisible && boundingClientRect.height > 0 && isElementOnTop(dom);
}; // eslint-disable-next-line sonarjs/cognitive-complexity


const exposureStatisDom = () => {
  if (isPauseExposure) {
    return;
  }

  const impressionStorage = window[COLLECT_DATA_STORAGE] ? [...window[COLLECT_DATA_STORAGE].entries()].filter(([key, value]) => {
    return key.current && [DATA_ATTR, EXPOSURE_DATA_ATTR].includes(value.type);
  }) : [];
  const storageDoms = impressionStorage.map(([key]) => key.current);
  const statisDoms = [...Array.from(document.querySelectorAll(`[${EXPOSURE_DATA_ATTR}]`)), ...Array.from(document.querySelectorAll(`[${DATA_ATTR}]`)), ...storageDoms];
  extraStatis.forEach(statis => {
    const dom = conversion2StatisDom(statis);

    if (dom) {
      statisDoms.push(dom);
    }
  });
  statisDoms.forEach(dom => {
    let dataSource = dom.getAttribute(EXPOSURE_DATA_ATTR) || dom.getAttribute(DATA_ATTR);

    if (!dataSource) {
      const currentStorage = impressionStorage.find(([key]) => {
        return key.current === dom;
      });

      if (currentStorage) {
        try {
          const data = currentStorage[1].callback();
          dataSource = JSON.stringify(data);
        } catch (error) {
          window[COLLECT_DATA_STORAGE].delete(currentStorage[0]);
          push({
            event_type: 'error',
            message: error
          });
        }
      }
    }

    if (isValidDataSource(dataSource) && !statisExposureEventData.includes(dataSource) && !waitExposureData.some(item => item.dataSource === dataSource) && isShouldExposure(dom)) {
      waitExposureData.push({
        startTime: Date.now(),
        dom,
        dataSource
      });
      monitorExposureStatisDom();
    }
  });
};

const monitorExposureStatisDom = (() => {
  let interval;
  let endTime = 0; // eslint-disable-next-line sonarjs/cognitive-complexity

  return () => {
    const nextEndTime = Date.now() + waitExposureTime;

    if (endTime < nextEndTime) {
      endTime = nextEndTime;
    }

    if (!interval) {
      interval = setInterval(() => {
        const currentTime = Date.now();
        const waitSendData = [];

        for (let i = waitExposureData.length - 1; i >= 0; i--) {
          const item = waitExposureData[i];

          if (isShouldExposure(item.dom)) {
            if (currentTime - item.startTime > waitExposureTime) {
              waitExposureData.splice(i, 1);
              statisExposureEventData.push(item.dataSource);
              waitSendData.push(item);
            }
          } else {
            waitExposureData.splice(i, 1);
          }
        }

        sendExposureData(waitSendData);

        if (currentTime > endTime) {
          clearInterval(interval);
          interval = null;
        }
      }, 100);
    }
  };
})();
/**
 * 调用后，延长时间 DELAY，每秒轮训1次，查找曝光DOM
 * 有些 DOM 在 onload 等事件之后才生成
 *
 * @type {(function(): void)|*}
 */


const monitorStatisDom = (() => {
  let interval;
  let endTime = 0;
  return () => {
    const DELAY = 5000;
    const nextEndTime = Date.now() + DELAY;

    if (endTime < nextEndTime) {
      endTime = nextEndTime;
    }

    if (!interval) {
      exposureStatisDom();
      interval = setInterval(() => {
        const currentTime = Date.now();

        if (currentTime > endTime) {
          clearInterval(interval);
          interval = null;
        } else {
          exposureStatisDom();
        }
      }, 100);
    }
  };
})(); // eslint-disable-next-line sonarjs/cognitive-complexity


const handleClick = (dom, attrName, isEmitByClick) => {
  let dataSource = dom.getAttribute(attrName);
  const clickStorage = window[COLLECT_DATA_STORAGE] ? [...window[COLLECT_DATA_STORAGE].entries()].filter(([key, value]) => {
    return key.current && value.type === attrName;
  }) : [];

  if (!dataSource) {
    const currentStorage = clickStorage.find(([key]) => key.current === dom);

    if (currentStorage) {
      try {
        const data = currentStorage[1].callback();
        dataSource = JSON.stringify(data);
      } catch (error) {
        // window[COLLECT_DATA_STORAGE].delete(currentStorage[0]);
        push({
          event_type: 'error',
          message: error
        });
      }
    }
  }

  if (isValidDataSource(dataSource)) {
    const eventData = JSON.parse(dataSource);
    push({
      event_type: 'behavior',
      ...eventData
    });
  } // 向上遍历DOM


  const parentEle = dom.closest(`[${attrName}]`);

  if (parentEle && dom !== parentEle) {
    handleClick(parentEle, attrName);
  } // 只在第一次进入函数需要遍历所有保存的变量值


  if (isEmitByClick) {
    clickStorage.forEach(([key]) => {
      if (key.current !== dom && key.current.contains(dom)) {
        handleClick(key.current, attrName);
      }
    });
  }
};

const handleElementClick = e => {
  let selectors = [];
  let currentEle = e.target;

  while (currentEle && currentEle !== document.body) {
    var _currentEle$className;

    let indexSelector = ''; // 避免死循环

    for (let i = 1; i < 100; i++) {
      if (currentEle.matches(`:nth-child(${i})`)) {
        indexSelector = `:nth-child(${i})`;
        break;
      }
    }

    if (currentEle.id) {
      selectors.push(`#${currentEle.id}${indexSelector}`);
    } else if ((_currentEle$className = currentEle.className) != null && _currentEle$className.trim != null && _currentEle$className.trim()) {
      const cls = currentEle.className.split(' ').filter(item => item.length);
      const cl = cls.reduce((previousValue, currentValue) => {
        var _context;

        return `${previousValue}.${replaceAll(_context = replaceAll(currentValue).call(currentValue, '[', '\\\\[')).call(_context, ']', '\\\\]')}`;
      }, '');
      selectors.push(`${cl}${indexSelector}`);
    } else {
      selectors.push(`${currentEle.localName}${indexSelector}`);
    }

    currentEle = currentEle.parentElement;
  }

  const result = selectors.reverse().join(' > ');
  push({
    event_type: 'behavior',
    event_id: 'element',
    selector: result,
    text: e.target.textContent
  });
};
/**
 * 对于设置 DATA_ATTR 属性的 DOM 进行埋点统计
 */


var listenStatisDom = (() => {
  document.addEventListener('click', e => {
    handleElementClick(e);
    handleClick(e.target, CLICK_DATA_ATTR, true);
    handleClick(e.target, DATA_ATTR, true);
  }, true);
  window.addEventListener('scroll', monitorStatisDom, {
    passive: true,
    capture: true
  });

  try {
    const callback = mutationList => {
      mutationList.forEach(mutation => {
        /* 从树上添加或移除一个或更多的子节点；参见 mutation.addedNodes 与 mutation.removedNodes */
        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length) {
            monitorStatisDom();
          }
        } else if (mutation.type === 'attributes') {
          monitorStatisDom();
        }
      });
    };

    const targetNode = document.body;
    const observerOptions = {
      childList: true,
      // 观察目标子节点的变化，是否有添加或者删除
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', DATA_ATTR, EXPOSURE_DATA_ATTR]
    };
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, observerOptions);
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
    window.addEventListener('DOMContentLoaded', monitorStatisDom);
    window.addEventListener('load', monitorStatisDom);
    window.addEventListener('click', () => {
      setTimeout(exposureStatisDom, 2000);
    }, true);
  }

  listenThirdPartyEvents();
});
const pauseExposureStatisDom = () => {
  isPauseExposure = true;
  statisExposureEventData = [];
  waitExposureData = [];
};
const resumeExposureStatisDom = () => {
  isPauseExposure = false;
  monitorStatisDom();
};
/**
 * 监听第三方服务的点击事件
 */

const listenThirdPartyEvents = () => {
  // Livechat 客服浮层 的点击事件
  window.addEventListener('blur', () => {
    if (document.activeElement.id === 'chat-widget') {
      push({
        event_type: 'behavior',
        event_id: 'modal_customer_service'
      });
    }
  });
};

const packageName = 'collectData';

const uploadExistingData = () => {
  const data = window[packageName];

  if (Array.isArray(data)) {
    data.forEach(item => {
      push(item);
    });
  }
};

let hasInit = false;
let prevPageEventUrl = '';

const init = async () => {
  try {
    // setting 是另一项目设置的变量，且 js 是异步加载的，需要等待加载完成
    while (!((_getSetting = getSetting()) != null && _getSetting.ace_store_id)) {
      var _getSetting;

      await delay(100);
    }

    hasInit = true;
    initAttributionData();
    initHistoryStack();
    uploadExistingData();
    listenStatisDom();
    listenError();
  } catch (error) {
    push({
      event_type: 'error',
      message: error
    });
  }
};

const getLastBehaviorData = key => {
  const lastBehaviorStr = window.sessionStorage.getItem(key);

  if (lastBehaviorStr) {
    try {
      var _lastBehavior$data;

      const lastBehavior = JSON.parse(lastBehaviorStr);
      const eventId = (_lastBehavior$data = lastBehavior.data) == null ? void 0 : _lastBehavior$data.event_id;

      if (eventId) {
        return lastBehavior;
      }
    } catch (e) {
      console.log('[ error ] > ', e);
    }
  }
}; // eslint-disable-next-line sonarjs/cognitive-complexity


const push = async (params, callback) => {
  try {
    // 避免 historyStack 还没初始化就触发 page 事件
    while (!hasInit) {
      await delay(100);
    }

    const data = typeof params === 'function' ? await params() : params;
    const {
      event_type,
      message
    } = data;

    if (event_type === 'page') {
      if (!data.url) {
        data.url = window.location.href;
      } // 防止触发多次相同的页面埋点


      if (data.url === prevPageEventUrl) {
        return;
      }

      prevPageEventUrl = data.url; // 暂停曝光统计，曝光统计在 pageView 之后触发

      pauseExposureStatisDom(data.url);
      pushHistoryStack(data.url); // 对跳转后重新统计曝光
      // HACK: 对于首页会记住位置，滚动到下面，但会曝光头部

      setTimeout(() => {
        resumeExposureStatisDom();
      }, 1000);
    } else if (event_type === 'behavior') {// console.log('behavior');
    } else if (event_type === 'impression') {// console.log('impression');
    } else if (event_type === 'monitor') {// console.log('monitor');
    } else if (event_type === 'error') {// if (!data.type) {
      //   log(message);
      //   data.type = 'buried-project';
      // }
      // // message 只能是字符串
      // const error =
      //   message instanceof Error ? message : new Error(JSON.stringify(message));
      // const stackMessage = (error.stack || error).toString();
      // const errMessage = stackMessage.includes(error.message)
      //   ? stackMessage
      //   : `${error.message}
      // ${stackMessage}
      // `;
      // data.message = errMessage;
      // // 死循环的时候栈越来越长，会导致不相等，故要截取
      // if (prevErrorMessage.slice(0, 50) === errMessage.slice(0, 50)) {
      //   return;
      // }
      // prevErrorMessage = errMessage;
    } else {
      log('请输入有效的 event_type 字段');
      return;
    } // if (event_type !== 'error') {
    //   prevErrorMessage = '';
    // }


    if (event_type === 'error') {
      // error埋点不上报
      return;
    }

    const fullData = composeSendData(data);
    const query = queryString.parse(location.search); // 搜索结果页曝光，增加对应搜索事件的数据

    if (fullData.event_type === 'page' && fullData.data.page_id === 'page_search_product_list') {
      const lastSearch = getLastBehaviorData(lastSearchKey);

      if (lastSearch) {
        var _lastSearch$data;

        const eventId = (_lastSearch$data = lastSearch.data) == null ? void 0 : _lastSearch$data.event_id;

        if (eventId) {
          var _lastSearch$data2, _lastSearch$data2$par, _lastSearch$data3, _lastSearch$data3$par;

          fullData.data.params.position = (_lastSearch$data2 = lastSearch.data) == null ? void 0 : (_lastSearch$data2$par = _lastSearch$data2.params) == null ? void 0 : _lastSearch$data2$par.position;
          let searchType = getSearchType(eventId) || ((_lastSearch$data3 = lastSearch.data) == null ? void 0 : (_lastSearch$data3$par = _lastSearch$data3.params) == null ? void 0 : _lastSearch$data3$par.search_type);
          fullData.data.params.search_type = searchType;
        }
      }
    } // 搜索结果页商品点击，增加对应搜索事件的数据，用于归因pp


    if (fullData.event_type === 'behavior' && ['click_btn_quick_shop', 'click_product'].includes(fullData.data.event_id) && fullData.data.page_id === 'page_search_product_list') {
      const lastSearch = getLastBehaviorData(lastSearchKey);

      if (lastSearch) {
        var _lastSearch$data4;

        const eventId = (_lastSearch$data4 = lastSearch.data) == null ? void 0 : _lastSearch$data4.event_id;

        if (eventId) {
          var _lastSearch$data$para, _lastSearch$data5, _lastSearch$data5$par, _lastSearch$data$para2;

          let searchType = getSearchType(eventId) || ((_lastSearch$data$para = lastSearch.data.params) == null ? void 0 : _lastSearch$data$para.search_type);
          fullData.data.params.search_position = data.search_position = (_lastSearch$data5 = lastSearch.data) == null ? void 0 : (_lastSearch$data5$par = _lastSearch$data5.params) == null ? void 0 : _lastSearch$data5$par.position;
          fullData.data.params.search_type = data.search_type = searchType;
          fullData.data.params.search_event_id = data.search_event_id = lastSearch.data.event_id;
          fullData.data.params.search_nav_name = data.search_nav_name = (_lastSearch$data$para2 = lastSearch.data.params) == null ? void 0 : _lastSearch$data$para2.nav_name;
        }
      }
    } // 商品集页、搜索结果页，url带filters[must] or 带sorts


    if (['page_search_product_list', 'page_category_product_list', 'page_activity_product_list'].includes(fullData.data.page_id)) {
      const filtersStr = query['filters[must]'];
      const sortsStr = query.sorts;
      const lastFilters = getLastBehaviorData(lastFiltersKey);
      const lastSort = getLastBehaviorData(lastSortKey);

      if (['click_btn_quick_shop', 'click_product'].includes(fullData.data.event_id)) {
        fullData.data.params.fillter_value = data.fillter_value = '';
        fullData.data.params.filter_name_value = data.filter_name_value = '';
        fullData.data.params.sorting_name = data.sorting_name = '';

        if (filtersStr && lastFilters) {
          var _lastFilters$data, _lastFilters$data$par;

          const filterObj = (_lastFilters$data = lastFilters.data) == null ? void 0 : (_lastFilters$data$par = _lastFilters$data.params) == null ? void 0 : _lastFilters$data$par.filter_value;

          if (filterObj && typeof filterObj === 'object') {
            const entries = Object.entries(filterObj);
            fullData.data.params.fillter_value = data.fillter_value = entries.map(i => i[0]).join(',');
            fullData.data.params.filter_name_value = data.filter_name_value = entries.map(i => i[1]).join(',');
          }
        }

        if (sortsStr && lastSort) {
          var _lastSort$data;

          const {
            sorting_name,
            sorting_status
          } = ((_lastSort$data = lastSort.data) == null ? void 0 : _lastSort$data.params) || {};

          if (sorting_status && sorting_name) {
            fullData.data.params.sorting_name = data.sorting_name = sorting_name;
          }
        }
      }
    }

    sendData(fullData);
    pushAttributionData({
      data,
      fullData
    });
    callback && callback();
  } catch (error) {
    // 必须是 sendError，不能用 push，会死循环
    // sendError(error);
    console.warn(error);
  }
};
init();

export { push };
