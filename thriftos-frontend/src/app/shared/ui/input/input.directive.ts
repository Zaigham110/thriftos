import { Directive, ElementRef, OnInit, Renderer2, inject } from '@angular/core';

@Directive({
  selector: 'input[appInput], input[uiInput]',
  standalone: true,
})
export class InputDirective implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'input');
  }
}
