import { CONNREFUSED } from 'dns';
import {Plugin,MarkdownView, TFile,MarkdownPostProcessor,MarkdownPostProcessorContext,MarkdownPreviewRenderer} from 'obsidian';
import { start } from 'repl';
import YAML from 'yaml'
import {IBlockMetadata} from "block-metadata"
import { listeners } from 'process';
import { time } from 'console';

export default class MyPlugin extends Plugin {

	globalTimeOut:any=null
	modifiedThroughPlugin=false
	blockMetadata:IBlockMetadata[] = new Array()
	currentFile:TFile
	data:string
	lastCursorPosition = new CodeMirror.Pos(0,0)
	cm:CodeMirror.Editor
	lastLineLength:number=1
	linesChanged:number=0
	yamlObject:any

	
	formatDate(date:Date):string{
		var getYear:string = date.getFullYear().toString();
        var getMonth:string = date.getMonth()+1 < 10 ? `0${date.getMonth()+1}`:`${date.getMonth()+1}`;	
        var getDate:string = date.getDate() < 10 ? `0${date.getDate()}`:`${date.getDate()}`
		var getHour:string = date.getHours()< 10 ? `0${date.getHours()}`:`${date.getHours()}`
		var getMinute:string = date.getMinutes()< 10 ? `0${date.getMinutes()}`:`${date.getMinutes()}`
		var getSecond:string = date.getSeconds()< 10 ? `0${date.getSeconds()}`:`${date.getSeconds()}`
		return  `${getYear}-${getMonth}-${getDate} ${getHour}:${getMinute}:${getSecond}`
	}

	getYamlString(){
		const lines = this.data.split("\n")
		var yamlString=""
		if(lines[0] == '---'){
			var n = 1
			while(lines[n] != '---'){
				yamlString+=lines[n]+"\n"
				n++
			}
		}
		return yamlString
	}
	
	generateUniqueBlockId(){
		return '^' + Math.random().toString(36).substr(2, 9);
	}
	
	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):number{
		const cursorLine = cm.getCursor().line
		const lines = this.data.split("\n")
		//get start line of block
		var currentLine = cursorLine;
		var startLineOfCurrentBlock = currentLine;
		var tempStartLineOfCurrentBlock = -1

		//check if it's in a list
		// if(this.isList(currentLine)){
		// 	// console.log("true")
		// 	return this.getStartOfList(currentLine)
		// }

		while(currentLine>0){
			if(lines[currentLine] == '' && tempStartLineOfCurrentBlock == -1 && currentLine != cursorLine){
				tempStartLineOfCurrentBlock = currentLine+1
			}
			if(lines[currentLine] == '---' && currentLine != cursorLine)
				break
			if(lines[currentLine] == "```" && currentLine != cursorLine)
				break
			if((lines[currentLine].startsWith('```') && lines[currentLine] != "```")){
				// if(lines[currentLine+1].startsWith('^'))	
				// 	return currentLine+1
				return currentLine
			}
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		if(tempStartLineOfCurrentBlock != -1)
			startLineOfCurrentBlock=tempStartLineOfCurrentBlock
		return startLineOfCurrentBlock;
	}

	isBlockMetadataStillValid(bm:any){
		//check if the temp block metadata still valid
		//it's still valid if the line above is either empty line, ---, or ```, or it's the first line
		//or if it's the start of a code block 
		const lines = this.data.split("\n")
		if(lines[bm.lineNumber] == bm.firstLineofBlock){
			if(lines[bm.lineNumber].startsWith("```"))
				return true
			if(bm.lineNumber == 0 || (bm.lineNumber>0 && (lines[bm.lineNumber-1] == '' 
			|| lines[bm.lineNumber-1] == '---' || lines[bm.lineNumber-1] == '```' || lines[bm.lineNumber-1].startsWith("```"))))
				return true
		}
		return false;
	}

	cleanMetadata(){
		//clean the metadata from non-existing block
		//run through each blocktimestamp element and check if that block still exist
		if(this.yamlObject){
			if(this.yamlObject.blockTimestamp){
				const lines = this.data.split("\n")
				this.yamlObject.blockTimestamp = this.yamlObject.blockTimestamp.filter((bt:any)=>{
					if(lines[bt.lineNumber] == bt.firstLine){
						if(lines[bt.lineNumber].startsWith("```"))
							return bt
						if(bt.lineNumber == 0 || (bt.lineNumber>0 && (lines[bt.lineNumber-1] == '' 
							|| lines[bt.lineNumber-1] == '---' || lines[bt.lineNumber-1] == '```')))
							return bt
					}
					this.linesChanged+=-4
				})
			}
		}
	}

	updateYamlObject(){
		this.blockMetadata.forEach(bm=>{
			//check if the bm still valid
			if(this.isBlockMetadataStillValid(bm)){
				//initialized yaml object if null
				if(this.yamlObject == undefined || this.yamlObject == null){
					this.yamlObject = new Object()
					this.linesChanged+=2
				}
				if(this.yamlObject.blockTimestamp == undefined || this.yamlObject == null){
					this.yamlObject.blockTimestamp = new Array()
					this.linesChanged+=1
				}
				
				//update yamlObject with new value
				var blockExist=false
				this.yamlObject.blockTimestamp = this.yamlObject.blockTimestamp.map((bt:any)=>{
					if(bt.lineNumber == bm.lineNumber){
						bt.modified  = bm.timestamp
						bt.firstLine = bm.firstLineofBlock
						blockExist=true
					}
					return bt
				})
				if(!blockExist){
					this.yamlObject.blockTimestamp.push({
						lineNumber:bm.lineNumber,
						firstLine:bm.firstLineofBlock,
						created:bm.timestamp,
						modified:bm.timestamp
					})
					this.linesChanged+=4
				}
			}
		})
	}

	replaceYaml(yamlString:string){
		var lines = this.data.split("\n")
		var newContent="---\n"
		newContent+=yamlString
		newContent+="---\n"
		var linePassed=0
		for(var n = 0;n<lines.length;n++){
			if(linePassed >= 2){
				newContent+=lines[n]+"\n"
			}
			if(lines[n] == '---'){
				linePassed++
			}
		}
		this.data = newContent
	}

	async updateDoc(currentFile:TFile){
		//update yaml and the content
		//get yaml as object
		this.updateYamlObject()
		this.cleanMetadata()
		this.updateBlockMetadata(0,this.linesChanged)
		//update the content
		if(this.yamlObject){
			var yamlString = YAML.stringify(this.yamlObject)//yamlString already include end newline
			var oldYaml = YAML.parse(this.getYamlString())
			if(oldYaml != undefined && oldYaml != null){
				//replace yaml front matter if it exist
				this.replaceYaml(yamlString)
			}
			else{
				//prepend metadata to content
				this.data = "---\n"+yamlString+"---\n"+this.data
			}
			this.modifiedThroughPlugin=true
			//update cursor position
			const cursorPos = this.cm.getCursor()
			cursorPos.line += this.linesChanged
			await this.app.vault.modify(currentFile,this.data)
			if(cursorPos.line<0){
				cursorPos.line=0
			}else if(cursorPos.line>=this.data.split("\n").length){
				cursorPos.line = this.data.split("\n").length-1
			}
			this.cm.setCursor(cursorPos)
			this.linesChanged=0
			this.blockMetadata = new Array()
			console.log("modified")
		}
	}

	updateTempMetadata(lineOrigin:number,different:number){
		if(this.blockMetadata){
			this.blockMetadata = this.blockMetadata.map(bm=>{
				if(bm.lineNumber>=lineOrigin){
					bm.lineNumber+=different
				}
				return bm
			})
		}
	}

	listenForCursorPosition(cm:CodeMirror.Editor){
		this.lastCursorPosition = cm.getCursor()
	}

	updateBlockMetadata(lineOrigin:number,different:number){
		if(this.yamlObject){
			if(this.yamlObject.blockTimestamp){
				this.yamlObject.blockTimestamp = this.yamlObject.blockTimestamp.map((bt:any)=>{
					if(bt.lineNumber>=lineOrigin){
						bt.lineNumber+=different
					}
					return bt
				})
			}
		}
	}
	
	async handleChange(cm:CodeMirror.Editor,co:CodeMirror.EditorChangeLinkedList){
			const leaf = this.app.workspace.activeLeaf;
			if(!leaf)
				return;
			const currentView = leaf.view as MarkdownView;
			const currentFile = currentView.file
			this.currentFile = currentFile
			this.data = cm.getValue()
			const changeTime = this.formatDate(new Date())
			const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
			const lines = this.data.split("\n")
			var currentLength = lines.length

			if(this.modifiedThroughPlugin){
				this.modifiedThroughPlugin=false;
				this.lastCursorPosition = cm.getCursor()
				this.lastLineLength=currentLength
				return
			}

			//check if doc length change
			//update tempMetadata if so
			var different =currentLength - this.lastLineLength
			if(different != 0){
				var lineOrigin
				if(co.origin=="+delete"){
					lineOrigin = co.from
				}else{
					lineOrigin = this.lastCursorPosition
				}
				if(lineOrigin.ch>0){
					lineOrigin.line+=1
				}
				this.updateTempMetadata(lineOrigin.line,different)
				this.updateBlockMetadata(lineOrigin.line,different)
				
			}

			//cursor is in the metadata, return
			if(startLineOfCurrentBlock == 1 && lines[startLineOfCurrentBlock-1] == '---'){
				this.lastCursorPosition = cm.getCursor()
				this.lastLineLength=currentLength
				return;
			}
			
			//update temp metadata
			if(lines[startLineOfCurrentBlock] != "" && lines[startLineOfCurrentBlock] != '---'){
				var blockExist=false
				this.blockMetadata = this.blockMetadata.map(bm=>{
					if(bm.lineNumber == startLineOfCurrentBlock){
						bm.firstLineofBlock=lines[startLineOfCurrentBlock]
						bm.timestamp = changeTime
						blockExist=true
					}
					return bm
				})
				if(!blockExist){
					this.blockMetadata.push({
						firstLineofBlock:lines[startLineOfCurrentBlock],
						timestamp:changeTime,
						lineNumber:startLineOfCurrentBlock
					})
				}
			}
			if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
			this.globalTimeOut = setTimeout(()=>this.updateDoc(currentFile),1000)
			//set last cursor position and last line length
			//to the current value
			this.lastCursorPosition = cm.getCursor()
			this.lastLineLength=currentLength
	}
	static postprocessor: MarkdownPostProcessor = (el: HTMLElement, ctx:MarkdownPostProcessorContext)=> {
		if(el.getElementsByClassName("frontmatter").length==0){
			var elStringSansHTML = el.innerHTML.replace(/(<([^>]+)>)/gi,"")
			var match = elStringSansHTML.match(/\^[a-z0-9]{9}/)
			console.log(el)
			console.log(el.innerHTML)
			if(match){
				var blockId = match[0]
				console.log(blockId)
				var yamlBlockTimestamp = ctx.frontmatter.blockTimestamp
				//create the regex
				//each character of the identifier could be put between html
				var regex=""
				for(var i = 0;i<blockId.length;i++){
					if(blockId[i] == "^"){
						regex+=`(<([^>]+)>){0,1}\\${blockId[i]}(<([^>]+)>){0,1}`
					}else{
						regex+=`(<([^>]+)>){0,1}${blockId[i]}(<([^>]+)>){0,1}`
					}
				}
				regex+="(\n)*"
				var element = el.childNodes[0];
				if(el.querySelector("code")){
					element = el.querySelector("code")
				}
				(element as HTMLElement).innerHTML = (element as HTMLElement).innerHTML.replace(new RegExp(regex,"gi"),"")
				if(yamlBlockTimestamp){
					yamlBlockTimestamp = yamlBlockTimestamp.filter((bt:any)=>{
						if(bt.id == blockId){
							return bt
						}
					})
					if(yamlBlockTimestamp.length>0){
						// console.log(yamlBlockTimestamp);
						(el.childNodes[0] as HTMLElement).innerHTML = `<span class='timestamp'>Created:${yamlBlockTimestamp[0].created},modified:${yamlBlockTimestamp[0].modified}</span>`+(el.childNodes[0] as HTMLElement).innerHTML 
						el.addEventListener("mouseenter",(e)=>{
							var element = (e.target as HTMLElement).querySelector("span.timestamp")
							element.classList.toggle("visible")
						})
						el.addEventListener("mouseleave",(e)=>{
							var element = (e.target as HTMLElement).querySelector("span.timestamp")
							element.classList.toggle("visible")
						})
					}
				}
			}
		}
		
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');
		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			this.cm=cm
			this.data = cm.getValue()
			this.yamlObject = YAML.parse(this.getYamlString())
			this.lastLineLength=cm.getValue().split("\n").length
			this.listenForCursorPosition = this.listenForCursorPosition.bind(this);
			cm.on("cursorActivity",this.listenForCursorPosition)
			this.handleChange = this.handleChange.bind(this)
			cm.on("change",this.handleChange)
		})
		MyPlugin.postprocessor = MyPlugin.postprocessor.bind(this)
		MarkdownPreviewRenderer.registerPostProcessor(MyPlugin.postprocessor)
	}

	onunload() {
		console.log('unloading plugin');
		this.registerCodeMirror((cm:CodeMirror.Editor)=>{
			cm.off("cursorActivity",this.listenForCursorPosition)
			cm.off("change",this.handleChange)
		})
	}
}