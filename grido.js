/*
class Grido: create tree grid
*/

var Grido = function(args)
{
  this.options = 
  {
    id:'', /*just identifier of the options*/
    container:'', /*element id*/
    subcontainerOnly:false,/*Grido will create one empty merged row beneath the parent row to be filled with some HTML via ajax*/
    className:'grido', /*css class to the whole structure*/
    parentField:'', /*matters only when tree is true*/
    childField:'',
    subField:'subs_num',
    levelField:'level',      
    expandIconClass:'icon-plus2',
    collapseIconClass:'icon-minus2',      
    fields:[],
    columns:[],
    dataset:[],
    height:450,
    editable:true,
    editFirstRow:false, /*false: disable edit/delete first row*/
    allowAddRow:true,
    allowDeleteRow:true,
    ajax:false, /*if set to true, there's should be one feature to load the sub-content of the active row*/
    data_post:[], /*data of the row to post along with ajax reload, e.g. ['user_id','username'] meaning that it will send record['user_id'] and record['username'] of the row*/
    tree:true, /*take tree or plain format*/
    firstParentId:0, /*only when tree is true*/
    allowGrandChild:true,/*allow adding new node below the newly created node*/
    save_url:'',
    load_url:'', /*only when ajax is true*/
    parameters:null, /*additional parameters, could be pool of data reference*/
    leftMenu:null,/*to add menu on the left that's hideable, could be string to be innerHTML or function that returns element object*/            
    onComplete:null, /*applied only when ajax is true*/
    beforeSave:null, /*triggered when saving data, return additional data*/
    afterSave:null, /*triggered after saving, in additon to update childField & parentField values*/
    beforeAdd:null, /*triggered when adding data, return row_data*/
    afterAdd:null,
    onUpdate:null /*when update a cell*/
  };
  for (var n in args)
  {
    this.options[n]=args[n];
  };
  this.init();
};

Grido.prototype = 
{
  init: function()
  {
    if(this.options.editable)
    {
      this.editors = {}; /*if editable, set variable editors*/ 
      /*Provide object for datepicker initialization*/
      this.datepickers = {};      
    }
    var container = document.getElementById(this.options.container);
    container.className = 'grido_container'; /*create container for header, body, and footer/menu*/
    container.style.height = this.options.height+'px';

    var header_container = document.createElement('div'); /*create container to be filled with one-row table containing headers*/
    header_container.className = 'header_container';
    if(this.options.tree)
    {
      var globalToggle = document.createElement('span');
      globalToggle.className = 'globalToggle glyphicon '+this.options.expandIconClass;
      globalToggle.addEventListener('click',function(e)
      {
        var rows = this.table.rows;
        var ctl = e.target;
        if(typeof ctl.stat==='undefined')
        {
          ctl.stat = '+';
        }
        for(var i=0;i<rows.length;i++)
        {
          this.expand(rows[i], ctl.stat);
          rows[i].stat = ctl.stat=='+' ? '-' : '+';
        }
        ctl.classList.toggle(this.options.expandIconClass);
        ctl.classList.toggle(this.options.collapseIconClass);
        ctl.stat = ctl.stat=='+' ? '-' : '+';         
      }.bind(this));
      header_container.appendChild(globalToggle);      
    }

    var header_table = document.createElement('table'); /*create one-row table of headers*/
    header_table.className = this.options.className;
    var thead = document.createElement('thead'), head_row = this.create_row(this.get_headers(),-1,'th',true);
    thead.appendChild(head_row);
    header_table.appendChild(thead);
    header_container.appendChild(header_table);

    var main_height = (this.options.height - (this.options.editable ? 53 : 30));

    var table_container = document.createElement('div'), table = this.create_table(); /*create main container to be filled with main table */
    table_container.className = 'table_container';
    table_container.style.height = main_height+'px';
    table_container.appendChild(table);
    this.table = table;

    /*if leftMenu is defined*/
    if(this.options.leftMenu)
    {
      var left_menu_button = document.createElement('span');
      left_menu_button.className = 'grido_left_menu_button glyphicon icon-menu2';
      left_menu_button.addEventListener('click', function(e)
      {
        var ctl = e.target;
        var x = typeof ctl.expanded!=='undefined' ? ctl.expanded : false;
        var el = this.leftmenu;
        var cur_right = el.right;
        var w = x ? cur_right : '0px';
        el.style.right = w;
        ctl.expanded = !x;
      }.bind(this));
      header_container.appendChild(left_menu_button);

      var left_menu_container = document.createElement('div');
      left_menu_container.id = 'grido_left_menu';
      left_menu_container.className = 'grido_left_menu';
      left_menu_container.style.height = (main_height-5)+'px';
      this.leftmenu = left_menu_container;
      var menu_container = document.createElement('div');
      menu_container.style.display = 'inline-block';

      if(typeof this.options.leftMenu=='string')
      {
        menu_container.innerHTML = this.options.leftMenu;  
      }
      if(typeof this.options.leftMenu=='function')
      {
        var el = this.options.leftMenu(this.options);
        menu_container.appendChild(el); 
      }
      
      left_menu_container.appendChild(menu_container);
      container.appendChild(left_menu_container);
      //get and modify style after the element is rendered (appended), otherwise IE will give you trouble by returning the getComputedStyle 'auto'
      var cur_width = (parseInt(getComputedStyle(left_menu_container, null).width.split('px')[0])+40)*(-1)+'px';
      left_menu_container.style.right = cur_width;
      left_menu_container.right = cur_width;      
    }
    container.appendChild(header_container);
    container.appendChild(table_container);    

    /*if the table is editable*/
    if(this.options.editable)
    {
      var menu_container = document.createElement('div'); /*create footer/menu container*/
      menu_container.className = 'menu_container';
      var menu_save = document.createElement('span'); /*@todo: replace text with glyphicon*/
      menu_save.className = 'menu_save nosave'; /*set first to no-save state*/
      menu_save.innerHTML = '<span style="font-size:14px;vertical-align:middle;" class="icon-disk"></span> Save';
      menu_save.addEventListener('click',function()
      {
        this.save();
      }.bind(this));
      menu_save.goSave = false; /*goSave means the data is ready to send to server*/
      this.menu_save = menu_save; /*let assign the element menu_save for easy recall later*/
      menu_container.appendChild(menu_save);      
      container.appendChild(menu_container);

      /*Provide object to contain all change*/
      this.deleted = [];
      this.inserted = {};
      this.updated = {};
      var self = this;
      for(var i in this.datepickers)
      {
        var timePicker = this.datepickers[i].indexOf(':')!==-1;
        new DatePicker(i,
        {
          allowEmpty:true,
          timePicker:timePicker,
          inputOutputFormat:this.datepickers[i],
          format:this.datepickers[i],
          onSelect:function(a,b,c)
          {
            var el = c;
            var row = el.parentNode.parentNode.parentNode;
            var value = el.value;
            //console.log(value)
            self.data_apply(el.col_name,value,row);
          }
        });
      }
    }
  },
  /**
   * creating main table with dataset
   * @return {object HTML}
   */
  create_table:function()
  {
    var table = document.createElement('table');
    table.className = this.options.className;
    var tbody = document.createElement('tbody'), body_data = this.options.dataset;
    for(var i=0;i<body_data.length;i++)
    {
      var row = this.create_row(body_data[i],i);
      row.className = 'hovering';
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }, 
  /**
   * Creating row
   * @param  object   row_data data taken from dataset for current row
   * @param  integer  index    key of dataset of related row_data
   * @param  string   el       whether create 'td' or 'th'
   * @param  boolean  header   header or not
   * @return object            element tr 
   */
  create_row:function(row_data,index,el,header)
  {
    el = typeof el !== 'undefined' ? el : 'td'; /*default td*/
    header = typeof header !== 'undefined' ? header : false; /*default not header*/
    index = typeof index !== 'undefined' ? index : -1; /*index -1 means new row, currently not saved*/

    var columns = this.options.columns, row = document.createElement('tr'), display = 'table-row';  
    row.childID = row_data[ this.options.childField ];  
    row.level = row_data[ this.options.levelField ];  
    row.record = row_data; /*attach the row data to tr*/


    if(!header && this.options.parentField && parseInt(row_data[ this.options.parentField ])!=this.options.firstParentId && this.options.tree)
    {
        display = 'none';
        row.parentID = row_data[ this.options.parentField ];
    }
    row.subs = row_data[ this.options.subField ];
    row.idx = index;
    for(var i=0;i<columns.length;i++)
    {
      var prefix = null;
      if(!i && !header && this.options.tree)
      {        
        var multiplier = !this.options.levelField?0:(row_data[ this.options.levelField ]+((multiplier && !row_data[ this.options.subField ])?1:0));
        var prefix = document.createElement('span');
        if(multiplier)
        {
          for(var j=0;j<multiplier;j++)
          {
            var span = document.createElement('span');
            span.className = 'tree_square';
            prefix.appendChild(span);
          }
        }
        var span = document.createElement('span');
        if(row_data[ this.options.subField ])
        {
            span.className = 'tree_square tree '+this.options.expandIconClass;
            span.events = {click: true};
            span.addEventListener('click',function()
            { 
              this.expand(row);
            }.bind(this));           
        }
        else
        {
            span.className = 'tree_square tree_arrow';
            span.innerHTML = '&raquo;';          
        }
        span.addEventListener('dblclick',function()
        {
          /*@todo: add feature to move from one parent to another*/
        });         
        prefix.appendChild(span);          
      }

      /*var attachEditEvent = typeof columns[i].editable!=='undefined' ? (attachEvent && columns[i].editable) : (columns[i].hidden===true ? false : attachEvent);*/

      if(header && this.options.editable && columns[i].hidden!==true)
      {
        columns[i]['attachEditEvent'] = typeof columns[i].editable!=='undefined' ? columns[i].editable : true;
        this.editors[columns[i].id] = typeof columns[i].editor !=='undefined' ? columns[i].editor : {type:'text'};
        if(typeof columns[i].renderer === 'undefined' && typeof columns[i].editor !=='undefined')
        {
          switch(columns[i].editor.type)
          {
            case 'select':
              columns[i].renderer = this.select_renderer;
              break;
            case 'checkbox':
              columns[i]['attachEditEvent'] = false;
              columns[i].renderer = this.checkbox_renderer;
              break;
            case 'date':
              columns[i]['attachEditEvent'] = false;
              if(columns[i].editable!==false)
              {
                if(typeof this.datepickers!=='undefined' && typeof this.datepickers["datepicker_"+this.options.container+'_'+columns[i].id]==='undefined')
                {
                  this.datepickers["datepicker_"+this.options.container+'_'+columns[i].id] = columns[i].editor.format !== 'undefined' ? columns[i].editor.format : 'Y-m-d';                  
                }
              }
              columns[i].renderer = this.date_renderer;
              break;
          }
        }
      }
      var renderer = (!header && typeof columns[i].renderer === 'function') ? columns[i].renderer : this.default_renderer;
      var cell_data = renderer.call(this, row_data[columns[i].id], row_data, columns[i]);
      
      var cell_width = 100;
      if(typeof columns[i].width!=='undefined')
      {
        cell_width = columns[i].width;
      }

      /*Dont attach event of edit to headers, to first row when first-row edit is not allowd, or if the grid is not set editable*/
      var attachEvent = header || (index===0 && !this.options.editFirstRow) || !this.options.editable ? false : columns[i]['attachEditEvent'];
      var cell = this.create_cell(columns[i].id,cell_data,el,prefix,attachEvent,cell_width);
      cell.colIndex = i;

      /*Lets attach row data to the first-column cell*/
      if(!header && !i)
      {
        cell.record = row_data;
      }
      if(this.options.editable)
      {
        if(!header && !i && index)
        {
          this.create_menu(cell);
        }
        if(!index && !i)
        {
          if(this.options.editFirstRow)
          {
            this.create_menu(cell);
          }
          else
          {
            this.create_menu(cell,false);
          }
        }
      } 
      if(columns[i].hidden===true)
      {
        cell.style.display='none';
      }
      if(header && typeof columns[i].textAlign === 'string')
      {
        cell.style.textAlign = columns[i].textAlign;
      }
      /*lets make checkbox center*/
      if(!header && typeof columns[i].editor!=='undefined' && columns[i].editor.type==='checkbox')
      {
        cell.style.textAlign = 'center';  
      }
      if(!header && typeof columns[i].cssClass === 'string')
      {
       cell.className = columns[i].cssClass;
      }
      row.appendChild(cell);
    }
    if(header){return row; }
    row.style.display = display;
    return row;
  },   
  create_cell:function(name,cell_data,el,prefix,attachEvent,width)
  {  
    prefix = typeof prefix !== 'undefined' ? prefix : null;
    attachEvent = typeof attachEvent !== 'undefined' ? attachEvent : true;
    var container = false;
    var cell = document.createElement(el); 

    if(attachEvent)
    {
      container = true;
      var cell_cont = document.createElement('span');
      cell_cont.className = 'cell_data';
      cell_cont.style.width = (width-10)+'px';
      cell_cont.col_name = name;

      if(typeof cell_data === 'object' && cell_data)
      {
        cell_cont.appendChild(cell_data);
      }
      else
      {
        cell_cont.innerHTML = cell_data;  
      }
      cell_cont.addEventListener('click',function(e){ this.edit(e); }.bind(this));
    }
    if(prefix!=null)
    {
      cell.appendChild(prefix);
    }
    else
    {
      if(container)
      {
        cell_cont.style.left = '0px';
        if(el=='th')
        {
          cell_cont.style.marginLeft = '5px';
          cell_cont.style.marginRight = '5px';        
        }        
      }
    }
    if(container)
    {
      cell.appendChild(cell_cont);  
    }
    else
    {
      var el = document.createElement('span');
      if(prefix!=null)
      {
        el.style.paddingLeft= '5px';  
      }
      if(typeof cell_data === 'object' && cell_data)
      {
        el.appendChild(cell_data);
      }
      else
      {
        el.innerHTML = cell_data;
      }
      cell.appendChild(el);
    }
    
    cell.style.width = width+'px';
    return cell;
  }, 
  get_headers:function()
  {
    var columns = this.options.columns, headers = {};
    for(var i=0;i<columns.length;i++)
    {
      var header = typeof columns[i].header !== 'undefined' ? columns[i].header : columns[i].id;
      headers[columns[i].id] = header;
    }
    return headers;
  },  
  create_menu:function(cell,deletable)
  {   
    deletable = !this.options.allowDeleteRow ? false : (typeof deletable !== 'undefined' ? deletable : true);
    var menu = document.createElement('span');
    menu.className = 'menu';
    menu.style.padding = '0px';
    menu.style.verticalAlign = 'top';

    if(this.options.ajax)
    {
      var span_cont = document.createElement('span');
      span_cont.style.display = 'table-cell';
      span_cont.style.verticalAlign = 'middle';
      span_cont.style.paddingRight = '5px';
      var span = document.createElement('span');
      span.className = 'icon-loop2 reload';
      span.addEventListener('click',function()
      {
        var data={};
        if(this.options.data_post.length)
        {
          var post = this.options.data_post;
          for(var i=0;i<post.length;i++)
          {
            data[post[i]] = cell.record[post[i]];
          }
        }
        var self = this;
        new ajax({
          url: this.options.load_url,
          data: data,
          func:function(data)
          {
            var options = JSON.parse(data); /*data from server must be in a form of json_encode*/
            var row = cell.parentNode;
            if(typeof options[self.options.childField]==='undefined')
            {
              self.remove_reload(row);
              return;
            }
            options[self.options.levelField] = cell.record[self.options.levelField]+1;
            options[self.options.parentField] = cell.record[self.options.childField];
            self.erase(row,true);
            self.attach_loaded_node(row,options);
            if(typeof self.options.onComplete=='function')
            {
              self.options.onComplete(row,options);  
            }
          }
        });
      }.bind(this));
      span_cont.appendChild(span);
      menu.appendChild(span_cont);      
    }

    var span_cont = document.createElement('span');
    span_cont.style.display = 'table-cell';
    if(this.options.allowAddRow)
    {
      var span = document.createElement('span');
      span.className = 'icon-plus3 add_node';
      span.addEventListener('click',function()
      {
        var row = cell.parentNode;
        this.add(row);
      }.bind(this));
      span_cont.appendChild(span);
      var txt = document.createElement('br');
      //txt.style.lineHeight = '2px';
      span_cont.appendChild(txt);
    }
    if(deletable)
    {
      var span = document.createElement('span');
      span.className = 'icon-cancel del_node';  
      span.addEventListener('click',function()
      {
        var row = cell.parentNode;
        this.erase(row);
      }.bind(this));               
      span_cont.appendChild(span);      
    }
    menu.appendChild(span_cont);
    cell.appendChild(menu);
    return cell;
  },   
  set_save_icon:function(save)
  {
    /*
    Never change CSS inline if you have hover on the element, cause inline-style will be stronger
    Lets say you set background change when the element's hovered
    if you change the background inline, the hover effect will be terminated because the background follow the inline rule
     */    
    var rem = save ? 'nosave' : 'gosave', add = !save ? 'nosave' : 'gosave';
    this.menu_save.classList.remove(rem);
    this.menu_save.classList.add(add);
    this.menu_save.goSave = save;
    return save;
  },
  /**
   * to give indicator when data is changed
   * @return {boolean} whether it's true to save or not
   */
  confirm_save:function()
  {
  	var n=0;
  	for(var item in this.inserted)
    {
  		n++;
  	}
  	var m=0;
  	for(var item in this.updated)
    {
  		m++;
  	}  	
    var ev = !(!n && !m && !this.deleted.length);
    return this.set_save_icon(ev);
	},
  update_row_properties:function(data)
  {
    for(var item in data)
    {
      var row = document.getElementById(item);
      if(row)
      {
        row.removeAttribute('id');
        row.childID = data[item];
        row.idx = 9999;
        if(typeof row.parentID!=='undefined' && String(row.parentID).substr(-1,1)=='n')
        {
          row.parentID = data[row.parentID];
        }
      }
    }
  },
  /**
   * save the changed data via ajax
   * @return {boolean}
   */
  save:function()
  {
  	if(!this.menu_save.goSave)
    {
  		return false;
  	}
    var data = {'inserted':this.inserted,'updated':this.updated,'deleted':this.deleted};
    if(typeof this.options.beforeSave==='function')
    {
      data['additional'] = this.options.beforeSave(data);
    }
  	new ajax({
  		url:this.options.save_url,
  		data:data,
      func:function(data)
      {
        if(data)
        {
          var result = JSON.parse(data);
          var data = {};
          if(typeof result.result!=='undefined')
          {
            data = result.result;
            this.update_row_properties(data);
          }          
        }
        this.set_save_icon(false);
        this.deleted = [];
        this.inserted = {};
        this.updated = {}; 
        if(typeof this.options.afterSave==='function')
        {
          this.options.afterSave(result,this);
        }               
      }.bind(this)
  	});
    return true;
  },
  default_renderer:function(value, record, colObj)
  {
    return typeof value!=='undefined' ? value : '';
  },
  select_renderer:function(value, record, colObj)
  { 
    return typeof this.editors[colObj.id].options[value]!=='undefined' ? this.editors[colObj.id].options[value] : '';
  },
  checkbox_renderer:function(value, record, colObj)
  {
    var el = document.createElement('input');
    el.type = 'checkbox';
    el.col_name = colObj.id;
    el.checkedValue = typeof this.editors[colObj.id].checkedValue!=='undefined' ? this.editors[colObj.id].checkedValue : 1;
    el.uncheckedValue = typeof this.editors[colObj.id].uncheckedValue!=='undefined' ? this.editors[colObj.id].uncheckedValue : 0;
    if(this.editors[colObj.id].checkedValue==value)
    {
      el.checked = true;
    }
    el.addEventListener('change',function(e)
    {
      var el = e.target;
      var row = el.parentNode.parentNode.parentNode;
      var value = el.checked ? el.checkedValue : el.uncheckedValue;
      this.data_apply(el.col_name,value,row);  
    }.bind(this));    
    return el;
  },
  date_renderer:function(value, record, colObj)
  {
    var el = document.createElement('input');
    el.type = 'text';
    el.col_name = colObj.id;
    el.value = value;
    el.style.width = (colObj.width-10)+'px';
    el.className = "datepicker_"+this.options.container+'_'+colObj.id;
    return el;    
  },
  expand:function(row, stat)
  {
    if(!row.subs)
    {
      return;
    }
    var toggle = (typeof stat === 'undefined'); /*auto toggle, otherwise stat should be defined*/
    stat = !toggle ? stat : (typeof row.stat !== 'undefined' ? row.stat : '+');
    row.displayed = (stat=='+'); /*originally it's written like | stat=='+' ? true : false | but hey, what if I ommit that format and rely on the evaluation result of (stat=='+') */    
    var pnt = row.parentNode, n=0, display = row.displayed ? 'table-row' : 'none', subs_num = row.subs;

  	if(toggle)
    {
  		row.stat = row.displayed ? '-' : '+';    	
    }
    var cls, els;
    if(stat=='+')
    {
      els = row.getElementsByClassName(this.options.expandIconClass);
      if(els.length)
      {
        cls = els[0];
        cls.classList.remove(this.options.expandIconClass);
        cls.classList.add(this.options.collapseIconClass);
        cls.style.color='red';        
      }
    }
    else
    {
      els = row.getElementsByClassName(this.options.collapseIconClass);
      if(els.length)
      {
        cls = els[0];
        cls.classList.add(this.options.expandIconClass);
        cls.classList.remove(this.options.collapseIconClass);      
        cls.style.color='#2fb9d0'; 
      }
    }    
    /*
    remember, rowIndex will start from header, if any.
     */
    for(var i=(row.rowIndex+1);i<pnt.rows.length;i++)
    {     
  		if(row.childID == pnt.rows[i].parentID)
      {
  			if(pnt.rows[i].stat==='-')
        {
  				this.expand(pnt.rows[i], stat);
  			}
  			pnt.rows[i].style.display = display, n++;
  			pnt.rows[i].displayed = row.displayed;
  		}
  		if(n==parseInt(subs_num)){ return;}
    }
  },
  edit:function(e)
  {
    e.stopPropagation();
    var cell = e.target;
    if(cell.tagName!=='SPAN')
    {
      return;
    }
    var editor = this.editors[cell.col_name];
    this.element_edit(cell, editor.options, editor.type);
  },
  element_edit:function(cell,selectOptions,tag)
  {
/*    if(tag=='checkbox' || tag=='date'){
      return;
    }
*/    
    var elType = tag=='select' ? tag : 'input';
    var el = document.createElement(elType);
    if(tag=='text')
    {
      el.value = htmlCodec.decode(cell.innerHTML);  
    }
    else
    {
      var w = getComputedStyle(cell, null).width.split('px');
      el.style.width = parseInt(w[0])+10+'px';
      var val = this.data_get(cell);
      for(var item in selectOptions)
      {
        var option = document.createElement('option');
        if(item==val)
        {
          option.setAttribute('selected','selected');
        }
        option.value = item;
        option.innerHTML = selectOptions[item];
        el.appendChild(option);
      }
    }
    el.addEventListener('change',function(e)
    {
      var row = e.target.parentNode.parentNode.parentNode;
      this.data_apply(e.target.parentNode.col_name,e.target.value,row);  
    }.bind(this));
    el.addEventListener('blur',function(e)
    {
      var ctl = e.target;
      var tag = e.target.tagName.toLowerCase();
      var span = ctl.parentNode;
      var value = ctl.value;
      if(tag=='select')
      {
        var cell = span.parentNode;
        var col = this.options.columns[cell.colIndex];
        span.innerHTML = col.renderer.call(this,value,null,col);
      }
      else
      {
        span.innerHTML = value;        
      }
    }.bind(this));    
    cell.innerHTML = '';
    cell.appendChild(el);
    el.focus();
  },
  data_get:function(ctl)
  {
    var row = ctl.parentNode.parentNode;
    if(row.idx!==-1)
    {
      var x = this.updated[row.childID];
      if(typeof x!=='undefined' && typeof x[ctl.col_name]!=='undefined')
      {
        return x[ctl.col_name];
      }
      else
      {
        return this.options.dataset[row.idx][ctl.col_name];
      }
    }
    else
    {
      return this.inserted[row.childID][ctl.col_name];
    }
  },
  data_apply:function(col_name,value,row)
  {
    if(row.idx!==-1)
    {
      if(typeof this.updated[row.childID]==='undefined')
      {
        this.updated[row.childID] = {};
        this.updated[row.childID][this.options.childField] = row.childID;
        if(this.options.tree)
        {
          this.updated[row.childID][this.options.parentField] = row.parentID;  
        }
      }
      this.updated[row.childID][col_name] = value;
    }
    else
    {
      this.inserted[row.childID][col_name] = value;
    }
    row.record[col_name] = value;
    if(typeof this.options.onUpdate==='function')
    {
      this.options.onUpdate(row,this.updated,this.inserted);
    }    
    this.confirm_save();
  },
  attach_loaded_node:function(row,row_data)
  {
    row.subs += 1;
    row_data[this.options.parentField] = row.childID, row_data[this.options.levelField] = row.level+1;
    var newNode = this.create_row(row_data);
    if((row.subs && row.stat=='-') || (row.subs==1 && row.displayed))
    {
      newNode.style.display = 'table-row';
      row.stat = '-';
    }
    else
    {
      row.stat = '+';
    }
    this.remove_reload(row);
    var tbody = row.parentNode;
    tbody.insertBefore(newNode,row.nextSibling); 
    this.change_icon(row);    
  },
  remove_reload:function(row)
  {
    var r = row.getElementsByClassName('reload')[0];
    r.parentNode.removeChild(r);
  },
  add:function(row,row_data)
  {
    if(this.options.allowGrandChild && String(row.childID).substr(-1,1)=='n')
    {
      return;
    }
    row.subs += 1;
    if(typeof row_data==='undefined')
    {
      var row_data = JSON.parse(JSON.stringify(this.options.dataset[0])); 
      row_data[this.options.columns[0].id] = 'New Node'; 
      if(this.options.tree)
      {
        row_data[this.options.subField] = 0;
        row_data[this.options.levelField] = row.level + 1;
        row_data[this.options.parentField] = row.childID;
      }
    }
    var n=0;
    for(var i in this.inserted)
    {
      n++;
    }
    var key = (n+1)+'_n';
    row_data[this.options.childField] = key;
    if(typeof this.options.beforeAdd==='function')
    {
      row_data = this.options.beforeAdd(row_data);
    }
    var newNode = this.create_row(row_data);
    newNode.id = key;
    delete row_data[this.options.subField];
    delete row_data[this.options.levelField];    
    if(this.options.tree)
    {
      if((row.subs && row.stat=='-') || (row.subs==1 && row.displayed))
      {
        newNode.style.display = 'table-row';
        row.stat = '-';
      }
      else
      {
        row.stat = '+';
      }      
    }
    this.inserted[key] = row_data;

    var tbody = row.parentNode;
    tbody.insertBefore(newNode,row.nextSibling); 
    if(typeof this.options.afterAdd==='function')
    {
      this.options.afterAdd(newNode, row);
    }    
    this.change_icon(row);
    this.confirm_save();
  },
  erase_data:function(row,eraseOnly)
  { 
    if(String(row.childID).substr(-1,1)!='n')
    {
      var data = {};
      data[this.options.childField] = row.childID;
      if(!eraseOnly){
        this.deleted.push(data);
      }
    }
    else
    {
      delete this.inserted[row.childID];
    }   
  },
  erase_subordinate:function(row,eraseOnly,main)
  {
    var pnt = row.parentNode;
    if(row.subs)
    {
      var rows = row.parentNode.rows;
      var start = (row.rowIndex+1), end = (start+row.subs);
      for(var i=start;i<end;i++)
      {
        this.erase_subordinate(rows[start],eraseOnly,false);
      }
    }
    this.erase_data(row,eraseOnly);
    if(main && eraseOnly)
    {
      row.subs = 0;
      this.change_icon(row);
      return;
    }
    pnt.removeChild(row);    
  },
  erase:function(row,eraseOnly)
  {/*eraseOnly means only to remove subordinate rows without recording the deletion of the data and leave the main row intact*/
    eraseOnly = typeof eraseOnly!=='undefined' ? eraseOnly : false;
    if(String(row.childID).substr(-1,1)!='n' && !eraseOnly && this.options.tree)
    {
      if(!confirm('You are deleting the existing data and its subordinates. Continue?'))
      {
        return;
      }
    }
    var rows = row.parentNode.rows;
    for(var i=0;i<rows.length;i++)
    {
      if(rows[i].childID==row.parentID)
      {
        rows[i].subs-=1;
        this.change_icon(rows[i]);
        break;
      }
    }
    this.erase_subordinate(row,eraseOnly,true);
    if(!eraseOnly)
    {
      this.confirm_save();  
    }
  },
  /**
   * change icon of expand or collapse
   * @param  {object} row the row in which the icon lies
   */
  change_icon:function(row)
  {
    if(row.subs==0)
    {
      var icons = row.getElementsByClassName('tree');
      if(icons.length)
      {
        var icon=icons[0];
        icon.className = 'tree_square tree_arrow',icon.innerHTML = '&raquo;';
        icon.removeAttribute('style');
      }      
    }
    else
    {
      var iconClass = this.options.expandIconClass;
      var iconColor='#2fb9d0';
      if(row.stat=='-' || row.displayed)
      {
        iconClass = this.options.collapseIconClass;
        var iconColor='red';
      }      
      var icons = row.getElementsByClassName('tree_arrow');
      if(icons.length)
      {
        var icon = icons[0];
        icon.className = 'tree_square tree ' + iconClass, icon.style.color = iconColor, icon.innerHTML = '';
        if(typeof icon.events==='undefined' || typeof icon.events.click==='undefined')
        {
          icon.addEventListener('click',function()
          {
            this.expand(row);
          }.bind(this));          
        }
      }      
    }
  }      
};

/*end of Grido*/

/**
 * Encode and decode special characters of HTML
 */
var htmlCodec = (function() {
    var charToEntityRegex,
        entityToCharRegex,
        charToEntity,
        entityToChar;

    function resetCharacterEntities() {
        charToEntity = {};
        entityToChar = {};
        // add the default set
        addCharacterEntities({
            '&amp;'     :   '&',
            '&gt;'      :   '>',
            '&lt;'      :   '<',
            '&quot;'    :   '"',
            '&#39;'     :   "'"
        });
    }

    function addCharacterEntities(newEntities) {
        var charKeys = [],
            entityKeys = [],
            key, echar;
        for (key in newEntities) {
            echar = newEntities[key];
            entityToChar[key] = echar;
            charToEntity[echar] = key;
            charKeys.push(echar);
            entityKeys.push(key);
        }
        charToEntityRegex = new RegExp('(' + charKeys.join('|') + ')', 'g');
        entityToCharRegex = new RegExp('(' + entityKeys.join('|') + '|&#[0-9]{1,5};' + ')', 'g');
    }

    function encode(value){
        var htmlEncodeReplaceFn = function(match, capture) {
            return charToEntity[capture];
        };

        return (!value) ? value : String(value).replace(charToEntityRegex, htmlEncodeReplaceFn);
    }

    function decode(value) {
        var htmlDecodeReplaceFn = function(match, capture) {
            return (capture in entityToChar) ? entityToChar[capture] : String.fromCharCode(parseInt(capture.substr(2), 10));
        };

        return (!value) ? value : String(value).replace(entityToCharRegex, htmlDecodeReplaceFn);
    }

    resetCharacterEntities();

    return {
        encode: encode,
        decode: decode
    };
})();
