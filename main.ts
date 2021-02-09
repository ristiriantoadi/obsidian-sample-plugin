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
		while(currentLine>0){
			if(lines[currentLine] == '' && tempStartLineOfCurrentBlock == -1 && currentLine != cursorLine){
				tempStartLineOfCurrentBlock = currentLine+1
			}
			if(lines[currentLine] == '---' && currentLine != cursorLine)
				break
			if(lines[currentLine] == "```" && currentLine != cursorLine)
				break
			if(lines[currentLine].startsWith('```') && lines[currentLine] != "```"){
				// if(lines[currentLine-1].startsWith('^'))	
				// 	return currentLine-1
				if(lines[currentLine+1].startsWith('^'))	
					return currentLine+1
				return currentLine
			}
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		if(tempStartLineOfCurrentBlock != -1)
			startLineOfCurrentBlock=tempStartLineOfCurrentBlock
		return startLineOfCurrentBlock;
	}

	isBlockExist(blockId:string){
		const lines = this.data.split("\n")
		for(var n = 0;n<lines.length;n++){
			if(lines[n] == blockId){
				//check the line below the matched line
				//if it's not an empty line then the block still exist 
				if(lines[n+1] != ''){
					//check the line above
					//if it's an empty line, ---, or ``` then it must be the start of block
					if(n == 0 || (n>0 && (lines[n-1] == ''  || lines[n-1] == '---' || lines[n-1] == '```'|| lines[n-1].startsWith("```")))){
						return true
					}
				}
			}
		}
		return false
	}

	removeBlockIdentifier(blockId:string){
		const lines = this.data.split("\n")
		var newContent=""
		for(var n=0;n<lines.length;n++){
			if(lines[n] != blockId){
				newContent+=lines[n]+"\n"
			}else{
				this.updateTempMetadata(n,-1)
				if(n<this.cm.getCursor().line)
					this.linesChanged+=-1
			}
		}
		this.data = newContent
	}

	isBlockMetadataStillValid(bm:any){
		//check if the temp block metadata still valid
		//it's still valid if the line above is either empty line, ---, or ```, or it's the first line
		const lines = this.data.split("\n")
		if(lines[bm.lineNumber] == bm.firstLineofBlock){
			if(bm.lineNumber == 0 || (bm.lineNumber>0 && (lines[bm.lineNumber-1] == '' 
			|| lines[bm.lineNumber-1] == '---' || lines[bm.lineNumber-1] == '```' || lines[bm.lineNumber-1].startsWith("```"))))
				return true
		}
		return false;
	}

	cleanMetadata(yamlObject:any){
		//clean the metadata from non-existing block
		//run through each blocktimestamp element and check if that block still exist
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.filter((b:any)=>{
					const blockId=b.id
					if(this.isBlockExist(blockId)){
						return b
					}else{
						//remove the block identifier
						//if the block identifier still exist in the content
						this.removeBlockIdentifier(blockId)//this change this.data
						this.linesChanged+=-3
					}
				})
			}
		}
		return yamlObject
	}

	updateYamlObject(yamlObject:any){
		var cursorPosition = this.cm.getCursor().line
		this.blockMetadata.forEach(bm=>{
			//check if the bm still valid
			if(this.isBlockMetadataStillValid(bm)){//this use line number
				//new block
				if(!bm.firstLineofBlock.startsWith("^")){
					if(yamlObject == null || yamlObject == undefined){
						yamlObject = new Object()
						this.linesChanged+=2					
					}
					if(yamlObject.blockTimestamp == null || yamlObject.blockTimestamp == undefined){
						yamlObject.blockTimestamp = new Array()
						this.linesChanged+=1
					}
					//generate new block id and append it to the start of the block
					var blockId = this.generateUniqueBlockId()
					const lines = this.data.split("\n")
					var blockLine=bm.lineNumber
					yamlObject.blockTimestamp.push({
						id:blockId,
						created:bm.timestamp,
						modified:bm.timestamp
					})
					this.linesChanged+=3
					var newContent=""
					for(var n = 0;n<lines.length;n++){
						if(n == blockLine){
							if(lines[n].startsWith("```")){
								newContent+=lines[n]+"\n";
								newContent+=blockId+"\n"
							}else{
								newContent+=blockId+"\n"
								newContent+=lines[n]+"\n";
							}
							
							if(n<=cursorPosition){
								this.linesChanged+=1
								cursorPosition+=1
							}
							this.updateTempMetadata(n,1)
						}else{
							newContent+=lines[n]+"\n";
						}
					}
					this.data = newContent
				}else{
					if(yamlObject){
						if(yamlObject.blockTimestamp){
							yamlObject.blockTimestamp = yamlObject.blockTimestamp.map((bt:any)=>{
								if(bt.id == bm.firstLineofBlock){
									bt.modified=bm.timestamp
								}
								return bt
							})
						}
					}
				}
			}
		})
		return yamlObject
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
		var yamlString = this.getYamlString()
		var yamlObject = YAML.parse(yamlString)
		var noYaml=true
		if(yamlObject){	
			noYaml=false
		}
		yamlObject = this.updateYamlObject(yamlObject)
		yamlObject=this.cleanMetadata(yamlObject)
		//update the content
		if(yamlObject){
			var yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
			if(!noYaml){
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
			this.cm.setCursor(cursorPos)
			this.linesChanged=0
			this.blockMetadata = new Array()
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
			}

			//cursor is in the metadata, return
			if(startLineOfCurrentBlock == 0 && lines[startLineOfCurrentBlock].startsWith("---")){
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
			if(match){
				var blockId = match[0]
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