/**
 * ajax class
 * @arguments 	object 	see below for detailed parameters
 * @param 	{string} 		url
 * @param 	{boolean} 		async: asynchronous
 * @param 	{object/string} data, can be object, HTML object, or string 
 * @param 	{function} 		func: function fired when ajax request is completed
 * @param 	{string} 		header 
 * @param 	{DOM object} 	form 
 * @return 	{void}
 */
var ajax = function(){
	this.defaults = {
		url:'',
		async:true,
		data:null,
		func:null,
		header:'application/x-www-form-urlencoded'
	};
    for (var n in arguments[0]){
		this.defaults[n]=arguments[0][n];
    };
    this.defaults.method=this.defaults.data?'POST':'GET';
    if(this.defaults.data){
	    var data_type=typeof this.defaults.data;
	    if(data_type=='object'){
	    	if(this.defaults.data.toString()=='[object HTMLFormElement]'){
	    		this.defaults.data='json_data='+JSON.stringify(get_form_data(this.defaults.data));	
	    	}else{
	    		this.defaults.data='json_data='+encodeURIComponent(JSON.stringify(this.defaults.data));
	    	}
	    	
	    }
	}
    this.request(this.defaults);
};
ajax.prototype = {
	request:function(options){
		var xhr = new window.XMLHttpRequest?new XMLHttpRequest():new ActiveXObject('Microsoft.XMLHTTP');
		xhr.open(options.method,options.url,options.async);
		if(options.async){
			xhr.onreadystatechange=function(){
				if(xhr.readyState===4 && xhr.status===200){
					if(options.func){
						options.func(xhr.responseText);
					}
				}
			}
		}else{
			if(options.func){
				options.func(xhr.responseText);	
			}
			
		}
		if(options.method=='POST'){
			xhr.setRequestHeader('Content-type',options.header);
		}
		xhr.send(options.data);
	}
};
