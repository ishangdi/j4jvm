/**
*用js模拟java虚拟机的运行。
*首先要解析Class文件。结构如下：
	
*
*@author zhouhuihui
*@date 2016-10-22
*/
$(function(){
	var sClassCode = $("#class_code").val();
	
	//启动一个虚拟机
	var jvm = $.j4jvm();
	var classCode = jvm.loadClass(sClassCode);

	var code = jvm.rendering();

	$("#parse_result").html(code);
	// $("span[escape_text]", "#parse_result").each(function(){
	// 	$(this).text(unescape($(this).attr("escape_text")));
	// });
	// $("#class_code").val(jvm.formatClassCode.join("\r\n"));

});

var jvm = {};
jvm.classCode;
jvm.formatClassCode = [];
jvm.curentPosition = 0;




