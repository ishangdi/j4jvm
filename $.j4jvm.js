/**
* $.j4jvm.js，用js解析Java字节码文件，并模拟JVM（特指HotSpot，以下不再解释）运行。
* 只是为了加深对JVM的理解。
* @author: zhouhuihui
* @date: 2016-10-23
* @version: 1.0
*/
;(function($) {
	var defaults = {
		name: "j4jvm",
		version: "1.0",
		about: "@zhouhuihui,2016-10-23"
	};
	var jvm = {};
	jvm.pointer = 0;	//字节码解析指针位置
	function j4jvm(options) {
		this.options = $.extend(defaults, options);
		//字节码列表
		this.classFileList = [];
	};

	//开放的方法
	j4jvm.prototype = {
		//加载字节码，并解析
		loadClass: function(classCode) {
			var classCodeArra = initClassCode(classCode);
			var rst = parseClassCode(classCodeArra);
			//将加载的字节码放到字节码列表中
			this.classFileList.push(rst);
			console.debug("加载类：", rst);
			if(jvm.pointer == classCodeArra.length) {
				console.debug("类解析完毕，大小：" + jvm.pointer);
			} else {
				console.debug("类未能完全解析，大小：" + jvm.pointer + " / " + classCodeArra.length);
			}
			return rst;
		},
		//渲染字节码
		rendering: function() {

			return rendering(this.classFileList[0]).join("<br/>");
		}
	};

	$.j4jvm = function(options) {

		return new j4jvm(options);
	};

	/**
	* 渲染Class代码
	* 将每个字段都解析成这种格式：字段名、字段中文名、16进制值、可视化字符串
	*/
	function rendering(cls) {
		var rst = [];
		for(var k in cls) {
			if(typeof cls[k].fmt === 'function') {
				cls[k].value = cls[k].fmt(cls[k].hex, cls.constant_pool.hex);//传入常量池，部分情况使用
			} else {
				cls[k].value = cls[k].hex;
			}

			rst.push(cls[k].name + "："+ cls[k].value+"");
		}

		return rst;
	}


	//解析字节码
	function parseClassCode(classCodeArra) {
		var cf = _getClassFile();
		
		//根据定义的结构名、长度解析字节码，对于常量池需要特殊处理
		for(var k in cf) {
			if(k === 'constant_pool') {//常量池
				cf[k].hex = parseConstantPool(hexToInt(cf[cf[k].length].hex), classCodeArra);
			} else if(k === 'fields'||k === 'methods') {//解析字段/方法
				cf[k].hex = parseFieldMethod(hexToInt(cf[cf[k].length].hex), classCodeArra, cf.constant_pool.hex);
			} else if(k === 'attributes') {//属性
				cf[k].hex = parseAttributes(hexToInt(cf[cf[k].length].hex), classCodeArra, cf.constant_pool.hex);
			} else if(typeof cf[k].length === 'string') {//指定长度所在字段
				cf[k].hex = getSubCode(classCodeArra, hexToInt(cf[cf[k].length].hex));
			} else {//指定长度
				cf[k].hex = getSubCode(classCodeArra, cf[k].length);
			}
		}

		return cf;
	}

	/**
	* 返回一个标准的字节码文件对象
	ClassFile {
	    u4 magic;                   //魔数，固定CA FE BA BE，表示java Class文件
	    u2 minor_version;           //副版本号    
	    u2 major_version;           //主版本号
	    u2 constant_pool_count;     //常量池计数器，
	    cp_info constant_pool[constant_pool_count-1]; //常量池列表    
	    u2 access_flags;            //访问标志    
	    u2 this_class;              //类索引，表示这个Class文件所定义的类或接口    
	    u2 super_class;             //父类索引
	    u2 interfaces_count;        //接口计数器    
	    u2 interfaces[interfaces_count];    //接口表，接口顺序和源代码顺序一致    
	    u2 fields_count;                    //字段计数器    
	    field_info fields[fields_count];    //字段表    
	    u2 methods_count;                   //方法计数器    
	    method_info methods[methods_count]; //方法表
	    u2 attributes_count;                //属性计数器    
	    attribute_info attributes[attributes_count];    //属性表
	}
	name：中文名，length：JVM规定的长度，hex：16进制字节码，value：hex转义后的值
	*/
	function _getClassFile() {
		//字节码文件格式
		var cp = {};
		cp.magic = {name:'魔数', length:4};
		cp.minor_version = {name:'次版本号', length:2, fmt:_fmtInt};
		cp.major_version = {name:'主版本号', length:2, fmt:_fmtMV};
		cp.constant_pool_count = {name:'常量池大小', length:2, fmt:_fmtInt};
		cp.constant_pool = {name:'常量池', length:'constant_pool_count', fmt:_fmtCP};
		cp.access_flags = {name:'访问标志', length:2, fmt:_fmtAF};
		cp.this_class = {name:'当前类', length:2, fmt:function(v){return "#"+_fmtInt(v);}};
		cp.super_class = {name:'父类', length:2, fmt:function(v){return "#"+_fmtInt(v);}};
		cp.interfaces_count = {name:'接口个数', length:2, fmt:_fmtInt};
		cp.interfaces = {name:'接口列表', length:'interfaces_count', fmt:_fmtString};
		cp.fields_count = {name:'字段个数', length:2, fmt:_fmtInt};
		cp.fields = {name:'字段列表', length:'fields_count', fmt:_fmtFieldMethod};
		cp.methods_count = {name:'方法个数', length:2, fmt:_fmtInt};
		cp.methods = {name:'方法列表', length:'methods_count', fmt:_fmtFieldMethod};
		cp.attributes_count = {name:'属性个数', length:2, fmt:_fmtInt};
		cp.attributes = {name:'属性列表', length:'attributes_count', fmt:_fmtAttr};

		//格式化字段/方法
		function _fmtFieldMethod(v, cp) {
			var _tmp = [];
			for(var j = 0; j < v.length; j++) {
				_tmp.push("	"+__accessFlag(v[j].access_flags)+" #"+hexToInt(v[j].name_index)
					+", #"+hexToInt(v[j].descriptor_index)+" 属性个数："+hexToInt(v[j].attributes_count)
					+_fmtAttr(v[j].atrributes, cp));
			}

			function __accessFlag(v) {
				v = v.replace(/[^A-F0-9]/g, '').split("");
				var rst = [];
				if(v[3] == 1) rst.push("public");
				if(v[3] == 2) rst.push("private");
				if(v[3] == 4) rst.push("protected");
				if(v[3] == 8) rst.push("static");
				if(v[2] == 1) rst.push("final");
				if(v[2] == 2) rst.push("synchronized");
				if(v[2] == 4) rst.push("volatile");
				if(v[2] == 8) rst.push("transient");
				if(v[1] == 1) rst.push("native");
				if(v[1] == 4) rst.push("abstract");
				if(v[1] == 8) rst.push("strictFP");
				if(v[0] == 1) rst.push("synthetic");	//编译器自动生成
				if(v[0] == 4) rst.push("enum");
				return rst.join(" ");
			}
			return "<br/>"+_tmp.join("<br/>");
		}

		//格式化属性
		function _fmtAttr(v, cp) {
			var _tmp = [];
			for(var j = 0; j < v.length; j++) {
				var idx = hexToInt(v[j].attribute_name_index);//属性索引，对应常量池的内容
				_tmp.push("		#"+idx+" "+v[j].info.name+" "+v[j].info.value + _fmtCode(v[j].info));
			}
			return ""+_tmp.join("<br/>");
		}

		//格式化指令字节码
		function _fmtCode(info) {
			if('code' in info && 'directions' in info.code) {
				var rst = [];
				var directions = info.code.directions;
				var idx = 0;
				$.each(directions, function(i, v) {
					rst.push("		#" + idx + " " + v.code + " " + (v.optNumArra||'') + " //" + v.help);
					idx += 1 + (v.optNumArra?v.optNumArra.length:0);
				});
				return "<br/>"+rst.join("<br/>");
			}


			return "";
		}

		//格式化Int
		function _fmtInt(v) {
			return hexToInt(v);
		}

		//格式化String
		function _fmtString(v) {
			return v?utf8ToString(v):"";
		}

		//格式化访问标志
		function _fmtAF(v) {
			v = v.replace(/[^A-F0-9]/g, '').split("");
			var rst = [];
			if(v[3] == 1) rst.push("public");
			if(v[2] == 1) rst.push("final");
			// if(v[2] == 2) rst.push("invoke"); jdk1.0.2之后编译的class都有该标志
			if(v[1] == 2) rst.push("interface");
			if(v[1] == 4) rst.push("abstract");
			if(v[0] == 1) rst.push("synthetic");	//编译器自动生成
			if(v[0] == 2) rst.push("annotation");
			if(v[0] == 4) rst.push("enum");
			return rst.join(" ");
		}

		//格式化java版本
		function _fmtMV(v) {
			return {'00 32':'Java6','00 33':'Java7','00 34':'Java8'}[v];
		}

		//格式化常量池
		function _fmtCP(v) {
			var _tmp = [];
			for(var j = 1; j < v.length; j++) {
				var _cp = jvm.constant_pool_tags.get(v[j].tag);
				_tmp.push("	#" +j+" "+_cp.name + "：" + v[j].value.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			}
			return "<br/>"+_tmp.join("<br/>");
		}

		return cp;
	};

	/**
	 * 解析字段/方法，二者格式相同，如下：
	 * u2 access_flags 访问标志
	 * u2 name_index 字段名称索引
	 * u2 descriptor_index 字段描述符索引
	 * u2 atrributes_count 使用的属性个数
	 * u2 atrributes 使用的属性列表
	 * @param {int} fields_count 字段个数
	 */
	function parseFieldMethod(count, classCodeArra, cp) {
		var rst = [];
		for(var i = 0; i < count; i++) {
			var fm = {};
			fm.access_flags = getSubCode(classCodeArra, 2);
			fm.name_index = getSubCode(classCodeArra, 2);
			fm.descriptor_index = getSubCode(classCodeArra, 2);
			fm.attributes_count = getSubCode(classCodeArra, 2);
			fm.atrributes = parseAttributes(hexToInt(fm.attributes_count), classCodeArra, cp);

			rst.push(fm);
		}

		return rst;
	}

	/**
	 * 解析属性
	 * 属性有三种，类属性、字段属性、方法属性，其中方法属性包含方法字节码（较为复杂）。
	 * 格式如下：
	 * u2 attribute_name_index 属性名索引，根据属性名区分属性值的解析格式。
	 * u4 attribute_length 属性内容长度
	 * u1 info[] 属性内容数组
	 * @param {int} fields_count 字段个数
	 */
	function parseAttributes(count, classCodeArra, cp) {
		var rst = [];
		for(var i = 0; i < count; i++) {
			var at = {};
			at.attribute_name_index = getSubCode(classCodeArra, 2);
			at.attribute_length = getSubCode(classCodeArra, 4);
			at.hex = getSubCode(classCodeArra, hexToInt(at.attribute_length));
			at.info = _parseAttr(cp, at.attribute_name_index, at.hex);

			rst.push(at);
		}

		/**
		* 解析属性中的属性值，不同类型的属性值格式不一样，其中Code（方法字节码）最为复杂。
		* 
		*/
		function _parseAttr(cp, idx, attr) {
			var rst = {};
			//根据属性名索引从常量池找到属性值。
			var _c = cp[hexToInt(idx)];
			rst.name = _c.value;
			rst.hex = attr;

			//字节码
			if(_c.value === 'Code') {//对应方法的字节码
				rst.code = _parseCode(cp, attr);//解析方法字节码
				rst.value = "";
			} else if(_c.value === 'ConstantValue') {//常量
				rst.value = " #" + hexToInt(attr);//属性值指常量索引
			} else if(_c.value === 'SourceFile') {//源文件
				rst.value = " #" + hexToInt(attr);//属性值指向源文件名
			} else if(_c.value === 'LineNumberTable') {//行号表
				alert("行号表");
			} else {//TODO 共20几种，以后补充解析
				alert("未解析的属性类型");
			}
			return rst;
		}


		/*
		* 解析方法字节码，结构如下：
		* u2 attribute_name_index 指向Code
		* u4 attribute_length 属性长度
		* u2 max_stack 最大栈深
		* u2 max_locals	最大局部变量表长度
		* u4 code_length 字节码长度
		* u1 code[]	字节码内容
		* u2 exception_table_length	异常表长度
		* exception_table[]	异常表内容
		* u2 attributes_count	属性个数
		* attributes[]	属性表
		*/
		function _parseCode(cp, attr) {
			var mtd = {};
			var code = initClassCode(attr);//将内容转为字节码格式
			var pos = -6;
			// mtd.attribute_name_index = subCode(code, pos+0, 2);
			// mtd.attribute_length = subCode(code, pos+2, 4);
			mtd.max_stack = subCode(code, pos+6, 2);
			mtd.max_locals = subCode(code, pos+8, 2);
			mtd.code_length = subCode(code, pos+10, 4);
			mtd.code = subCode(code, pos+14, hexToInt(mtd.code_length));
			mtd.directions = _parseInstructions(mtd.code);
			pos = pos+14 + hexToInt(mtd.code_length);
			mtd.exception_table_length = subCode(code, pos, 2);
			mtd.exception_table = subCode(code, pos + 2, hexToInt(mtd.exception_table_length));
			pos = pos + 2 + hexToInt(mtd.exception_table_length);
			mtd.attributes_count = subCode(code, pos, 2);
			mtd.attributes = subCode(code, pos + 2, hexToInt(mtd.attributes_count));

			console.log("字节码解析结果：", JSON.stringify(mtd));
			return mtd;
		}

		return rst;
	}

	/**
	* 解析字节码指令
	*/
	function _parseInstructions(code) {
		code = initClassCode(code);
		var directions = [];
		var i = 0;
		while(i < code.length) {
			var bytecode = subCode(code, i++, 1);
			var dir = jvm.directions.get(bytecode);
			dir.hex = bytecode;
			if(dir.optNums > 0) {
				dir.optNumArra = subCode(code, i, dir.optNums).split(" ");
				i += dir.optNums;
			}
			directions.push(dir);
		}

		return directions;
	}

	/**
	 * 解析常量池，第9-10个字节为常量池大小，后面紧跟着常量池表
	 * 常量池表的结构：常量类型 参数1[ 参数2]，参数2只有个别常量类型才有
	 * @param {int} constantSize 常量池大小
	 */
	function parseConstantPool(constantSize, classCodeArra) {
		var rst = [];
		rst[0] = null;
		
		for(var i = 1; i < constantSize; i++) {
			var _cp = {};
			//常量类型，当前位置1个字节
			_cp.tag = getSubCode(classCodeArra, 1);
			switch(_cp.tag) {
				//UTF8，u2=byte[]数组长度，参数2为byte[]数组，存放具体的字符串（utf-8编码）
				case jvm.constant_pool_tags.CONSTANT_Utf8_info.code: 
					_cp.length = getSubCode(classCodeArra, 2);
					_cp.bytes = getSubCode(classCodeArra, hexToInt(_cp.length));
					_cp.value = utf8ToString(_cp.bytes);
				break;
				//类或接口的符号引用，u2=指向UTF8的索引
				case jvm.constant_pool_tags.CONSTANT_Class_info.code:
					_cp.name_index = getSubCode(classCodeArra, 2);
					_cp.value = "#" + hexToInt(_cp.name_index);
				break;
				//int类型字面量，u4=高位在前存储
				case jvm.constant_pool_tags.CONSTANT_Integer_info.code:
					_cp.bytes = getSubCode(classCodeArra, 4);
					_cp.value = utf8ToString(_cp.bytes);
				break;
				//long类型字面量，u8=高位在前存储
				case jvm.constant_pool_tags.CONSTANT_Long_info.code:
					_cp.bytes =getSubCode(classCodeArra, 8);
					_cp.value = utf8ToString(_cp.bytes);
				break;
				//float类型字面量，u4=高位在前存储
				case jvm.constant_pool_tags.CONSTANT_Float_info.code:
					_cp.bytes = getSubCode(classCodeArra, 4);
					_cp.value = utf8ToString(_cp.bytes);
				break;
				//double类型字面量，u8=高位在前存储
				case jvm.constant_pool_tags.CONSTANT_Double_info.code:
					_cp.bytes = getSubCode(classCodeArra, 8);
					_cp.value = utf8ToString(_cp.bytes);
				break;
				//String类型字面量，u2=指向UTF8的索引
				case jvm.constant_pool_tags.CONSTANT_String_info.code:
					_cp.string_index = getSubCode(classCodeArra, 2);
					_cp.value = "#" + hexToInt(_cp.string_index);
				break;
				//字段的符号引用，u2=类或接口的索引，u2=字段名及描述符
				case jvm.constant_pool_tags.CONSTANT_Fieldref_info.code:
				//类中方法的符号引用，u2=类的索引，u2=方法简单名称及描述符
				case jvm.constant_pool_tags.CONSTANT_Methodref_info.code: 
				//接口中方法的符号引用，u2=接口的索引，u2=方法简单名称及描述符
				case jvm.constant_pool_tags.CONSTANT_InterfaceMethodref_info.code: 
					_cp.class_index = getSubCode(classCodeArra, 2);
					_cp.name_and_type_index = getSubCode(classCodeArra, 2);

					_cp.value = "#" + hexToInt(_cp.class_index) + ", #" + hexToInt(_cp.name_and_type_index);
				break;
				//字段或方法的符号引用，u2=字段或方法名，u2=描述符
				case jvm.constant_pool_tags.CONSTANT_NameAndType_info.code: 
					_cp.name_index = getSubCode(classCodeArra, 2);
					_cp.descriptor_index = getSubCode(classCodeArra, 2);

					_cp.value = "#" + hexToInt(_cp.name_index) + ", #" + hexToInt(_cp.descriptor_index);
				break;
				default:
					console.error("ERROR-常量类型不存在["+i+"]：" + _cp.tag);
				break;
			}
			// console.debug("_cp["+i+"]", JSON.stringify(_cp));
			rst.push(_cp);
		}

		return rst;
	}

	/**
	* 16进制转为10进制
	*/
	function hexToInt(num) {
		var _int = parseInt(num.replace(/[^A-F0-9]/g, ''), 16);
		return _int;
	}

	/**
	 * 16进制转为字符串
	 * @param {Object} bytes
	 */
	function utf8ToString(bytes) {
	　　return unescape(("\\u00"+bytes.split(" ").join("\\u00")).replace(/\\/g, "%"));
	}

	/**
	 * 初始化字节码字符串
	 * 去掉特殊字符，并两位一组
	 * @param {Object} sClassCode
	 */
	function initClassCode(sClassCode) {
		var str = sClassCode.toUpperCase().replace(/[^A-F0-9]/g, '');
		var rst = [];
		for(var i = 0; i < str.length - 1; i += 2) {
			rst.push(str[i] + str[i+1]);
		}
		
		return rst;
	}

	/**
	 * 从字节码中指定位置截取指定长度的部分字节码
	 * 从1开始
	 * 注意调用slice方法，截取的字符串包含起始位置，不包含结束位置
	 * @param string classCodeArra 源字节码数组
	 * @param int len 截取长度
	 */
	function getSubCode(classCodeArra, len) {
		var start = jvm.pointer + 1;
		var rst = classCodeArra.slice(start - 1, start + len - 1).join(" ");
		jvm.pointer += len;
		return rst;
	}

	function subCode(code, start, len) {
		var rst = code.slice(start, start + len).join(" ");

		return rst;
	}

	//常量池类型
	jvm.constant_pool_tags = {};
	jvm.constant_pool_tags.CONSTANT_Utf8_info = {code:'01',name:'utf8编码字符串'};
	jvm.constant_pool_tags.CONSTANT_Integer_info = {code:'03',name:'整型字面量'};
	jvm.constant_pool_tags.CONSTANT_Float_info = {code:'04',name:'单精度浮点型字面量'};
	jvm.constant_pool_tags.CONSTANT_Long_info = {code:'05',name:'长整型字面量'};
	jvm.constant_pool_tags.CONSTANT_Double_info = {code:'06',name:'双精度浮点型字面量'};
	jvm.constant_pool_tags.CONSTANT_Class_info = {code:'07',name:'类或接口的符号引用'};
	jvm.constant_pool_tags.CONSTANT_String_info = {code:'08',name:'字符串类型字面量'};
	jvm.constant_pool_tags.CONSTANT_Fieldref_info = {code:'09',name:'字段的符号引用'};
	jvm.constant_pool_tags.CONSTANT_Methodref_info = {code:'0A',name:'类中方法的符号引用'};
	jvm.constant_pool_tags.CONSTANT_InterfaceMethodref_info = {code:'0B',name:'接口中方法的符号引用'};
	jvm.constant_pool_tags.CONSTANT_NameAndType_info = {code:'0C',name:'字段或方法的部分符号引用'};
	jvm.constant_pool_tags.CONSTANT_MethodHandle_info = {code:'0F',name:'方法句柄'};
	jvm.constant_pool_tags.CONSTANT_MethodType_info = {code:'10',name:'方法类型'};
	jvm.constant_pool_tags.CONSTANT_InvokeDynamic_info = {code:'12',name:'动态调用的方法句柄'};
	jvm.constant_pool_tags.get = function(code) {
		for(var k in jvm.constant_pool_tags) {
			if(jvm.constant_pool_tags[k].code === code) {
				return jvm.constant_pool_tags[k];
			}
		}
		return null;
	};

	//异常
	jvm.exceptions = {};
	//公用异常
	jvm.exceptions.BAD_CLASS_CODE = {code:"E0001", msg:"字节码未知错误"};
	//解析字节码相关异常
	jvm.exceptions.BAD_MAGIC = {code:"E0101", msg:"魔数异常"};
	jvm.exceptions.BAD_MINOR_VERSION = {code:"E0102", msg:"次版本格式错误"};
	jvm.exceptions.BAD_MAJOR_VERSION = {code:"E0103", msg:"主版本格式错误"};
	jvm.exceptions.BAD_CONSTANT_TAG = {code:"E0104", msg:"常量类型错误"};
	jvm.exceptions.BAD_CONSTANT_ = {code:"E0105", msg:"常量格式错误"};
	jvm.exceptions.BAD_ACCESS_FLAGS = {code:"E0106", msg:"类访问标志错误"};

	/**
	* JVM字节码指令，用2个字节，最多表示256个指令
	* code：操作码，num：操作数个数，help：说明
	*/
	jvm.directions = {};
	jvm.directions['00'] = {code:'nop', optNums:2, help:'什么都不做'};
	jvm.directions['01'] = {code:'aconst_null', optNums:0, help:'将null推送至栈顶'};
	jvm.directions['02'] = {code:'iconst_m', optNums:4, help:'变量送至栈顶'};
	jvm.directions['03'] = {code:'iconst_0', optNums:0, help:'将int型0送至栈顶'};
	jvm.directions['04'] = {code:'iconst_1', optNums:0, help:'将int型1送至栈顶'};
	jvm.directions['06'] = {code:'iconst_3', optNums:0, help:'将int型3送至栈顶'};
	jvm.directions['07'] = {code:'iconst_4', optNums:0, help:'将int型4送至栈顶'};
	jvm.directions['0A'] = {code:'lconst_1', optNums:0, help:'将long型1送至栈顶'};
	jvm.directions['12'] = {code:'ldc', optNums:1, help:'将int、float或String型常量值从常量池中推送至栈顶'};
	jvm.directions['16'] = {code:'lload', optNums:2, help:'将Long型变量栈顶'};
	jvm.directions['1B'] = {code:'iload_1', optNums:0, help:'第二个int型局部变量进栈'};
	jvm.directions['1C'] = {code:'iload_2', optNums:0, help:'第三个int型局部变量进栈'};
	jvm.directions['2A'] = {code:'aload_0', optNums:0, help:'将引用型变量送至栈顶'};
	jvm.directions['3D'] = {code:'istore_2', optNums:0, help:'将栈顶int型数值存入第三个局部变量'};
	jvm.directions['59'] = {code:'dup', optNums:0, help:'复制栈顶数值，并且复制值进栈'};
	jvm.directions['84'] = {code:'iinc', optNums:2, help:'指定int型变量增加指定值'};
	jvm.directions['A2'] = {code:'if_icmpge', optNums:2, help:'比较栈顶两int型数值大小，当结果大于等于0时跳转'};
	jvm.directions['AC'] = {code:'ireturn', optNums:0, help:'当前方法返回int'};
	jvm.directions['A7'] = {code:'goto', optNums:2, help:'无条件跳转'};
	jvm.directions['B1'] = {code:'return', optNums:0, help:'返回void'};
	jvm.directions['B2'] = {code:'getstatic', optNums:2, help:'获取指定类的静态域，并将其值压入栈顶'};
	jvm.directions['B6'] = {code:'invokevirtual', optNums:2, help:'调用实例方法'};
	jvm.directions['B7'] = {code:'invokespecial', optNums:2, help:'调用超类构造方法'};
	jvm.directions['BB'] = {code:'new', optNums:2, help:'创建一个对象，并且其引用进栈'};
	jvm.directions['FF'] = {code:'impdep2', optNums:0, help:'i dont know'};
	//根据字节码找到指令
	jvm.directions.get = function(bytecode) {
		if(bytecode in jvm.directions) {
			//对象深拷贝
			return jQuery.extend(true, {}, jvm.directions[bytecode]);
		}

		console.error("指令不存在：" + bytecode);
		return {code:'指令不存在：' + bytecode, optNums:999999, help:'指令不存在：' + bytecode};
	};
})(jQuery);