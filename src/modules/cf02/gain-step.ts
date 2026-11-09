import{add,compare,decimal,neg,type Rational}from'./rational';
/** Decimal-native keyboard increments retain entered digits instead of accumulating binary .1 additions. */
export function gainStep(current:string,direction:1|-1,large=false):string{
  const low=decimal('.05'),high=decimal('50'),value=decimal(current,true);if(compare(value,low)<0||compare(value,high)>0)throw new Error('Checked gain must be .05…50.');
  const step=decimal(large?'1':'.1'),next=add(value,direction===1?step:neg(step));return decimalText(compare(next,low)<0?low:compare(next,high)>0?high:next);
}
function decimalText(value:Rational){
  let den=value.d,twos=0,fives=0;while(den%2n===0n){den/=2n;twos++;}while(den%5n===0n){den/=5n;fives++;}if(den!==1n)throw new Error('This native control requires a terminating decimal.');
  const places=Math.max(twos,fives),n=value.n*2n**BigInt(places-twos)*5n**BigInt(places-fives),digits=n.toString().padStart(places+1,'0');
  const text=places?`${digits.slice(0,-places)}.${digits.slice(-places)}`.replace(/0+$/,'').replace(/\.$/,''):digits;
  if(text.length>1200)throw new Error('The exact keyboard gain exceeds the native coefficient length budget. Use a shorter value.');return text;
}
