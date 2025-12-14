const display = document.getElementById("display");
const historyBox = document.getElementById("history");
let memory = 0;

// Append value to display
function appendValue(val){ display.value += val; }

// Clear display
function clearDisplay(){ display.value = ""; }

// Delete last character
function delChar(){ display.value = display.value.slice(0,-1); }

// Calculate power
function calculatePower(expr){
    if(expr.includes("^")){
        let [a,b] = expr.split("^");
        return Math.pow(Number(a), Number(b));
    }
    return eval(expr);
}

// Calculate expression
function calculate(){
    try{
        let expr = display.value;
        let result = calculatePower(expr);
        display.value = result;
        saveHistory(expr + " = " + result);
    }catch{
        display.value = "Error";
    }
}

// Save history
function saveHistory(item){
    let p = document.createElement("p");
    p.innerText = item;
    historyBox.appendChild(p);
    historyBox.scrollTop = historyBox.scrollHeight;
}

// Scientific functions
function scientific(fn){
    let v = parseFloat(display.value);
    if(isNaN(v)) return;
    let result;
    switch(fn){
        case "sin": result = Math.sin(v*Math.PI/180); break;
        case "cos": result = Math.cos(v*Math.PI/180); break;
        case "tan": result = Math.tan(v*Math.PI/180); break;
        case "sqrt": result = Math.sqrt(v); break;
        case "log": result = Math.log10(v); break;
        case "ln": result = Math.log(v); break;
    }
    display.value = result;
    saveHistory(`${fn}(${v}) = ${result}`);
}

// Memory functions
function memoryAction(action){
    switch(action){
        case "M+": memory += parseFloat(display.value || 0); break;
        case "M-": memory -= parseFloat(display.value || 0); break;
        case "MR": display.value = memory; break;
        case "MC": memory = 0; break;
    }
}

// Copy result
function copyResult(){
    navigator.clipboard.writeText(display.value);
    alert("Copied: " + display.value);
}

// Button click events
document.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
        let val = btn.dataset.val;
        let key = btn.dataset.key;
        let fn = btn.dataset.fn;
        let mem = btn.dataset.mem;

        if(val) appendValue(val);
        else if(fn) scientific(fn);
        else if(mem) memoryAction(mem);
        else if(key === "Escape") clearDisplay();
        else if(key === "Backspace") delChar();
        else if(key === "Enter") calculate();
    });
});

// Keyboard support
document.addEventListener("keydown", e=>{
    let key = e.key;
    let btn = [...document.querySelectorAll("button")].find(b=>b.dataset.key===key || b.dataset.val===key);
    if(btn){
        btn.classList.add("active-key");
        setTimeout(()=>btn.classList.remove("active-key"),150);
    }

    if(!isNaN(key) || "+-*/.%".includes(key)) appendValue(key);
    else if(key==="Enter") calculate();
    else if(key==="Backspace") delChar();
    else if(key==="Escape") clearDisplay();
});

// Theme toggle
function toggleTheme(){
    document.body.classList.toggle("dark");
}
